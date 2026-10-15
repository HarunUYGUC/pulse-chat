export interface VoiceSignalingHandlers {
  sendOffer?: (targetConnectionId: string, sdp: string) => Promise<void>;
  sendAnswer?: (targetConnectionId: string, sdp: string) => Promise<void>;
  sendCandidate?: (targetConnectionId: string, candidate: any) => Promise<void>;
  onSpeakingChange?: (userId: number, isSpeaking: boolean) => void;
  onConnectionStatusChange?: (status: 'connected' | 'disconnected') => void;
  getCurrentUserId?: () => number | undefined;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

/**
 * Modifies WebRTC SDP to enforce Opus audio parameters:
 * - usedtx=1: Discontinuous transmission (stops transmitting audio packets during silence,
 *   breaking acoustic feedback loops and eliminating infinite crescendo echo / Larsen effect).
 * - stereo=0: Forces mono audio (activates phone & laptop hardware AEC / Acoustic Echo Canceller DSPs).
 * - useinbandfec=1: In-band forward error correction for mobile packet loss recovery.
 * - maxaveragebitrate=32000: 32kbps mono voice (crystal clear voice, prevents saturation clipping).
 */
function optimizeOpusSdp(sdp: string): string {
  if (!sdp) return sdp;

  // Locate the Opus payload type number, e.g. "a=rtpmap:111 opus/48000/2"
  const opusRtpmapMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!opusRtpmapMatch) return sdp;

  const pt = opusRtpmapMatch[1];
  const fmtpRegex = new RegExp(`^a=fmtp:${pt}\\s+(.*)$`, 'm');
  const fmtpMatch = sdp.match(fmtpRegex);

  const desiredParams: Record<string, string> = {
    stereo: '0',
    usedtx: '1',
    useinbandfec: '1',
    maxaveragebitrate: '32000',
    minptime: '10',
    cbr: '0',
  };

  if (fmtpMatch) {
    const existingParams = fmtpMatch[1].split(';').map((p) => p.trim());
    const paramMap: Record<string, string> = {};

    existingParams.forEach((param) => {
      const [k, v] = param.split('=');
      if (k) paramMap[k.toLowerCase()] = v || '';
    });

    Object.entries(desiredParams).forEach(([k, v]) => {
      paramMap[k.toLowerCase()] = v;
    });

    const newParamStr = Object.entries(paramMap)
      .map(([k, v]) => (v ? `${k}=${v}` : k))
      .join(';');

    return sdp.replace(fmtpRegex, `a=fmtp:${pt} ${newParamStr}`);
  } else {
    // No existing fmtp line, insert one right after rtpmap
    const paramStr = Object.entries(desiredParams)
      .map(([k, v]) => `${k}=${v}`)
      .join(';');
    const rtpmapLine = opusRtpmapMatch[0];
    return sdp.replace(rtpmapLine, `${rtpmapLine}\r\na=fmtp:${pt} ${paramStr}`);
  }
}

class WebRtcService {
  private localStream: MediaStream | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private pendingPlayAudioElements: Set<HTMLAudioElement> = new Set();
  private hasUnlockerAttached: boolean = false;
  private selectedOutputDeviceId: string = '';

  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localSpeakingState: boolean = false;
  private vadInterval: number | null = null;

  private remoteAnalysers: Map<string, AnalyserNode> = new Map();
  private remoteSpeakingStates: Map<number, boolean> = new Map();
  private remoteVadIntervals: Map<string, number> = new Map();

  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private handlers: VoiceSignalingHandlers = {};

  public setSignalingHandlers(handlers: VoiceSignalingHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public async setOutputDevice(deviceId: string) {
    this.selectedOutputDeviceId = deviceId;
    for (const audioEl of this.audioElements.values()) {
      if ('setSinkId' in audioEl && typeof (audioEl as any).setSinkId === 'function') {
        try {
          await (audioEl as any).setSinkId(deviceId);
        } catch (err) {
          console.warn('Failed to set audio sink ID:', err);
        }
      }
    }
  }

  /**
   * Unlocks mobile audio autoplay restrictions (iOS Safari / Android Chrome)
   * on the first touch or click interaction.
   */
  private registerAutoplayUnlocker() {
    if (this.hasUnlockerAttached || typeof window === 'undefined') return;
    this.hasUnlockerAttached = true;

    const unlock = () => {
      // 1. Play queued audio elements
      this.pendingPlayAudioElements.forEach((el) => {
        if (el && el.paused) {
          el.play()
            .then(() => {
              this.pendingPlayAudioElements.delete(el);
            })
            .catch(() => {});
        } else {
          this.pendingPlayAudioElements.delete(el);
        }
      });

      // 2. Resume AudioContext if suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      if (this.pendingPlayAudioElements.size === 0) {
        window.removeEventListener('click', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
        window.removeEventListener('pointerdown', unlock, true);
        this.hasUnlockerAttached = false;
      }
    };

    window.addEventListener('click', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('pointerdown', unlock, true);
  }

  public async startLocalAudio(deviceId?: string): Promise<MediaStream> {
    this.stopLocalAudio();

    // Warm up / unlock AudioContext during the user's initial click gesture
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      }
    } catch (err) {
      console.warn('Could not warm up AudioContext:', err);
    }

    // Professional audio constraints:
    // - echoCancellation: ideal true (enables hardware/driver acoustic echo cancellation)
    // - noiseSuppression: ideal true (filters out background fans, room noise, static)
    // - autoGainControl: ideal true (evens out voice volume without clipping)
    // - channelCount: 1 (mono audio activates hardware AEC on mobile chips and eliminates cross-talk)
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
        // Chromium / WebKit specific flags
        googEchoCancellation: { ideal: true },
        googAutoGainControl: { ideal: true },
        googNoiseSuppression: { ideal: true },
        googHighpassFilter: { ideal: true },
        googTypingNoiseDetection: { ideal: true },
      } as MediaTrackConstraints,
      video: false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      // Fallback: omit exact deviceId and vendor flags, but KEEP core AEC & noise suppression!
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });
      } catch {
        // Last-resort fallback for restrictive webviews
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
    }

    // Reinforce constraints on active audio tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track
          .applyConstraints({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          })
          .catch(() => {});
      });
    }

    // Apply mute/deafen states if already toggled
    this.applyAudioTrackStates();

    // Setup AudioContext for Voice Activity Detection (VAD)
    this.setupLocalVad();

    return this.localStream;
  }

  private setupLocalVad() {
    try {
      if (!this.localStream) return;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 512;
      this.localAnalyser.smoothingTimeConstant = 0.4;
      source.connect(this.localAnalyser);

      let silenceCounter = 0;
      this.localSpeakingState = false;
      const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);

      if (this.vadInterval) {
        window.clearInterval(this.vadInterval);
      }

      this.vadInterval = window.setInterval(() => {
        const currentUserId = this.handlers.getCurrentUserId?.();
        if (!this.localAnalyser || this.isMuted || this.isDeafened) {
          if (this.localSpeakingState && currentUserId) {
            this.localSpeakingState = false;
            this.handlers.onSpeakingChange?.(currentUserId, false);
          }
          return;
        }

        this.localAnalyser.getByteFrequencyData(dataArray);

        // Vocal band energy (approx 200 Hz to 3500 Hz: bins 2 to 38)
        // Eliminates false triggers from AC/fan rumbles (<180 Hz) and keyboard hiss (>4000 Hz)
        const minVoiceBin = 2;
        const maxVoiceBin = Math.min(38, dataArray.length);
        let voiceSum = 0;
        for (let i = minVoiceBin; i < maxVoiceBin; i++) {
          voiceSum += dataArray[i];
        }
        const voiceAverage = voiceSum / (maxVoiceBin - minVoiceBin);

        // Total energy across spectrum
        let totalSum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          totalSum += dataArray[i];
        }
        const totalAverage = totalSum / dataArray.length;

        if (!currentUserId) return;

        // Tuned voice activity threshold: avoids ambient room noise, fan hiss, and shallow breathing
        const isVoiceActive = voiceAverage >= 22 && totalAverage >= 14;

        if (isVoiceActive) {
          silenceCounter = 0;
          if (!this.localSpeakingState) {
            this.localSpeakingState = true;
            this.handlers.onSpeakingChange?.(currentUserId, true);
          }
        } else {
          silenceCounter++;
          // 5 ticks (500ms) hangover time prevents clipping sentence endings
          if (silenceCounter >= 5 && this.localSpeakingState) {
            this.localSpeakingState = false;
            this.handlers.onSpeakingChange?.(currentUserId, false);
          }
        }
      }, 100);
    } catch (err) {
      console.warn('VAD AudioContext setup skipped or not supported:', err);
    }
  }

  public async connectToPeer(targetConnectionId: string, targetUserId: number) {
    if (this.peers.has(targetConnectionId)) {
      return;
    }

    const pc = this.createPeerConnection(targetConnectionId, targetUserId);
    this.peers.set(targetConnectionId, pc);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      // Optimize Opus SDP parameters (DTX=1, mono=1, FEC=1, 32kbps)
      const optimizedSdp = optimizeOpusSdp(offer.sdp || '');
      const localDesc = new RTCSessionDescription({
        type: offer.type,
        sdp: optimizedSdp,
      });
      await pc.setLocalDescription(localDesc);

      if (localDesc.sdp) {
        await this.handlers.sendOffer?.(targetConnectionId, localDesc.sdp);
      }
    } catch (err) {
      console.error(`Failed to create/send offer to peer ${targetConnectionId}:`, err);
    }
  }

  public async handleReceiveOffer(senderConnectionId: string, senderUserId: number, sdp: string) {
    let pc = this.peers.get(senderConnectionId);
    if (!pc) {
      pc = this.createPeerConnection(senderConnectionId, senderUserId);
      this.peers.set(senderConnectionId, pc);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();

      // Optimize Opus SDP parameters
      const optimizedSdp = optimizeOpusSdp(answer.sdp || '');
      const localDesc = new RTCSessionDescription({
        type: answer.type,
        sdp: optimizedSdp,
      });
      await pc.setLocalDescription(localDesc);

      if (localDesc.sdp) {
        await this.handlers.sendAnswer?.(senderConnectionId, localDesc.sdp);
      }
    } catch (err) {
      console.error(`Failed to handle offer from ${senderConnectionId}:`, err);
    }
  }

  public async handleReceiveAnswer(senderConnectionId: string, sdp: string) {
    const pc = this.peers.get(senderConnectionId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } catch (err) {
      console.error(`Failed to set remote answer from ${senderConnectionId}:`, err);
    }
  }

  public async handleReceiveIceCandidate(senderConnectionId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peers.get(senderConnectionId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error(`Failed to add ICE candidate from ${senderConnectionId}:`, err);
    }
  }

  private createPeerConnection(targetConnectionId: string, targetUserId: number): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local audio tracks if available
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.handlers.sendCandidate?.(targetConnectionId, event.candidate.toJSON());
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.handlers.onConnectionStatusChange?.('connected');
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        // Handled on peer disconnect
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;

      // Attach audio element with mobile-friendly playback attributes
      let audioEl = this.audioElements.get(targetConnectionId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.setAttribute('webkit-playsinline', 'true');
        audioEl.setAttribute('preload', 'auto');
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        this.audioElements.set(targetConnectionId, audioEl);

        // Apply selected output device if supported by browser
        if (
          this.selectedOutputDeviceId &&
          'setSinkId' in audioEl &&
          typeof (audioEl as any).setSinkId === 'function'
        ) {
          (audioEl as any).setSinkId(this.selectedOutputDeviceId).catch(() => {});
        }
      }

      audioEl.srcObject = remoteStream;
      audioEl.muted = this.isDeafened;
      // 0.90 volume leaves headroom to avoid hardware speaker non-linear clipping distortion
      audioEl.volume = 0.9;

      const playAudio = () => {
        if (!audioEl || this.isDeafened) return;
        const promise = audioEl.play();
        if (promise !== undefined) {
          promise.catch((err) => {
            console.warn(
              `Autoplay blocked for peer ${targetConnectionId}, waiting for user interaction:`,
              err
            );
            this.pendingPlayAudioElements.add(audioEl!);
            this.registerAutoplayUnlocker();
          });
        }
      };

      playAudio();

      // Trigger playback again as soon as media packets start flowing
      const audioTrack = event.track;
      if (audioTrack) {
        audioTrack.onunmute = () => {
          playAudio();
        };
      }

      // Setup remote VAD to indicate when this remote user is speaking
      this.setupRemoteVad(targetConnectionId, targetUserId, remoteStream);
    };

    return pc;
  }

  private setupRemoteVad(connectionId: string, userId: number, stream: MediaStream) {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      this.remoteAnalysers.set(connectionId, analyser);

      // Clear existing interval if present
      const existingInterval = this.remoteVadIntervals.get(connectionId);
      if (existingInterval) {
        window.clearInterval(existingInterval);
      }

      let silenceCounter = 0;
      this.remoteSpeakingStates.set(userId, false);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const interval = window.setInterval(() => {
        if (!this.peers.has(connectionId)) {
          window.clearInterval(interval);
          this.remoteVadIntervals.delete(connectionId);
          if (this.remoteSpeakingStates.get(userId)) {
            this.remoteSpeakingStates.set(userId, false);
            this.handlers.onSpeakingChange?.(userId, false);
          }
          return;
        }

        analyser.getByteFrequencyData(dataArray);

        // Vocal band energy (bins 2 to 38)
        const minVoiceBin = 2;
        const maxVoiceBin = Math.min(38, dataArray.length);
        let voiceSum = 0;
        for (let i = minVoiceBin; i < maxVoiceBin; i++) {
          voiceSum += dataArray[i];
        }
        const voiceAverage = voiceSum / (maxVoiceBin - minVoiceBin);

        let totalSum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          totalSum += dataArray[i];
        }
        const totalAverage = totalSum / dataArray.length;

        const isVoiceActive = voiceAverage >= 20 && totalAverage >= 12;
        const wasSpeaking = this.remoteSpeakingStates.get(userId) || false;

        if (isVoiceActive) {
          silenceCounter = 0;
          if (!wasSpeaking) {
            this.remoteSpeakingStates.set(userId, true);
            this.handlers.onSpeakingChange?.(userId, true);
          }
        } else {
          silenceCounter++;
          if (silenceCounter >= 5 && wasSpeaking) {
            this.remoteSpeakingStates.set(userId, false);
            this.handlers.onSpeakingChange?.(userId, false);
          }
        }
      }, 100);

      this.remoteVadIntervals.set(connectionId, interval);
    } catch {
      // Remote VAD fallback
    }
  }

  public removePeer(connectionId: string, userId?: number) {
    const pc = this.peers.get(connectionId);
    if (pc) {
      pc.close();
      this.peers.delete(connectionId);
    }

    const audioEl = this.audioElements.get(connectionId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      this.audioElements.delete(connectionId);
      this.pendingPlayAudioElements.delete(audioEl);
    }

    const vadInterval = this.remoteVadIntervals.get(connectionId);
    if (vadInterval) {
      window.clearInterval(vadInterval);
      this.remoteVadIntervals.delete(connectionId);
    }

    this.remoteAnalysers.delete(connectionId);

    if (userId) {
      this.remoteSpeakingStates.delete(userId);
      this.handlers.onSpeakingChange?.(userId, false);
    }
  }

  public setMute(isMuted: boolean) {
    this.isMuted = isMuted;
    this.applyAudioTrackStates();
  }

  public setDeafen(isDeafened: boolean) {
    this.isDeafened = isDeafened;
    // Mute/unmute remote audio elements
    this.audioElements.forEach((el) => {
      el.muted = isDeafened;
      if (!isDeafened && el.paused) {
        el.play().catch(() => {
          this.pendingPlayAudioElements.add(el);
          this.registerAutoplayUnlocker();
        });
      }
    });
    this.applyAudioTrackStates();
  }

  private applyAudioTrackStates() {
    if (!this.localStream) return;
    const shouldEnable = !this.isMuted && !this.isDeafened;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = shouldEnable;
    });
  }

  private stopLocalAudio() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.vadInterval) {
      window.clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.localSpeakingState = false;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close().catch(() => {});
      } catch {}
      this.audioContext = null;
    }
    this.localAnalyser = null;
  }

  public stopAll() {
    this.stopLocalAudio();

    this.peers.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    this.peers.clear();

    this.audioElements.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {}
    });
    this.audioElements.clear();
    this.pendingPlayAudioElements.clear();

    this.remoteVadIntervals.forEach((interval) => window.clearInterval(interval));
    this.remoteVadIntervals.clear();
    this.remoteAnalysers.clear();
    this.remoteSpeakingStates.clear();

    this.isMuted = false;
    this.isDeafened = false;
    this.handlers.onConnectionStatusChange?.('disconnected');
  }
}

export const webrtcService = new WebRtcService();
