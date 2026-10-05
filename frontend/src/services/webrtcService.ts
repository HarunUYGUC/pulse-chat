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
};

class WebRtcService {
  private localStream: MediaStream | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalysers: Map<string, AnalyserNode> = new Map();
  private vadInterval: number | null = null;
  private isMuted: boolean = false;
  private isDeafened: boolean = false;
  private handlers: VoiceSignalingHandlers = {};

  public setSignalingHandlers(handlers: VoiceSignalingHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public async startLocalAudio(deviceId?: string): Promise<MediaStream> {
    this.stopLocalAudio();

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      // Fallback to basic audio constraint if exact device fails
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 512;
      this.localAnalyser.smoothingTimeConstant = 0.4;
      source.connect(this.localAnalyser);

      let silenceCounter = 0;
      const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);

      if (this.vadInterval) {
        window.clearInterval(this.vadInterval);
      }

      this.vadInterval = window.setInterval(() => {
        const currentUserId = this.handlers.getCurrentUserId?.();
        if (!this.localAnalyser || this.isMuted || this.isDeafened) {
          if (currentUserId) {
            this.handlers.onSpeakingChange?.(currentUserId, false);
          }
          return;
        }

        this.localAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        if (!currentUserId) return;

        // VAD threshold
        if (average > 14) {
          silenceCounter = 0;
          this.handlers.onSpeakingChange?.(currentUserId, true);
        } else {
          silenceCounter++;
          if (silenceCounter > 3) {
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
      await pc.setLocalDescription(offer);

      if (offer.sdp) {
        await this.handlers.sendOffer?.(targetConnectionId, offer.sdp);
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
      await pc.setLocalDescription(answer);

      if (answer.sdp) {
        await this.handlers.sendAnswer?.(senderConnectionId, answer.sdp);
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
        // Will attempt to reconnect
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;

      // Attach audio element
      let audioEl = this.audioElements.get(targetConnectionId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        this.audioElements.set(targetConnectionId, audioEl);
      }

      audioEl.srcObject = remoteStream;
      audioEl.muted = this.isDeafened;
      audioEl.play().catch(() => {});

      // Setup remote VAD to indicate when this remote user is speaking
      this.setupRemoteVad(targetConnectionId, targetUserId, remoteStream);
    };

    return pc;
  }

  private setupRemoteVad(connectionId: string, userId: number, stream: MediaStream) {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      this.remoteAnalysers.set(connectionId, analyser);

      let silenceCounter = 0;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const interval = window.setInterval(() => {
        if (!this.peers.has(connectionId)) {
          window.clearInterval(interval);
          this.handlers.onSpeakingChange?.(userId, false);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        if (average > 14) {
          silenceCounter = 0;
          this.handlers.onSpeakingChange?.(userId, true);
        } else {
          silenceCounter++;
          if (silenceCounter > 3) {
            this.handlers.onSpeakingChange?.(userId, false);
          }
        }
      }, 100);
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
    }

    this.remoteAnalysers.delete(connectionId);

    if (userId) {
      this.handlers.onSpeakingChange?.(userId, false);
    }
  }

  public setMute(isMuted: boolean) {
    this.isMuted = isMuted;
    this.applyAudioTrackStates();
  }

  public setDeafen(isDeafened: boolean) {
    this.isDeafened = isDeafened;
    // Mute remote audio elements
    this.audioElements.forEach((el) => {
      el.muted = isDeafened;
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
    this.remoteAnalysers.clear();
    this.isMuted = false;
    this.isDeafened = false;
    this.handlers.onConnectionStatusChange?.('disconnected');
  }
}

export const webrtcService = new WebRtcService();
