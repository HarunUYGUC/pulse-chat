import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Headphones, Volume2, X, Check, Activity } from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';

export const VoiceSettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    audioInputDevices,
    audioOutputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    setSelectedAudioInput,
    setSelectedAudioOutput,
  } = useVoiceStore();

  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  const testStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const stopMicTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
    }
    setIsTestingMic(false);
    setMicVolume(0);
  };

  const startMicTest = async () => {
    try {
      stopMicTest();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
      });
      testStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setIsTestingMic(true);
    } catch (err) {
      console.warn('Failed to start microphone test:', err);
    }
  };

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  const handleClose = () => {
    stopMicTest();
    setSettingsOpen(false);
  };

  if (!isSettingsOpen) return null;

  return createPortal(
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 2050 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
        <div className="modal-content pc-modal">
          {/* Header */}
          <div
            className="modal-header pc-modal-header d-flex align-items-center justify-content-between p-3 border-bottom"
            style={{ borderColor: 'var(--pc-border)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <Volume2 size={20} className="text-primary" />
              <h5 className="modal-title fw-bold text-white mb-0">Voice Settings</h5>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link p-1 ms-auto d-flex align-items-center justify-content-center rounded-circle"
              style={{
                width: '32px',
                height: '32px',
                color: '#949ba4',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#949ba4';
              }}
              onClick={handleClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-body p-4">
            {/* Input Device (Microphone) */}
            <div className="mb-4">
              <label className="pc-form-label d-flex align-items-center gap-2">
                <Mic size={15} className="text-primary" />
                <span>INPUT DEVICE (MICROPHONE)</span>
              </label>
              <select
                className="form-select pc-input"
                value={selectedAudioInput}
                onChange={(e) => setSelectedAudioInput(e.target.value)}
                style={{ backgroundColor: '#1e1f22', borderColor: '#383a40', color: '#fff' }}
              >
                <option value="">Default System Microphone</option>
                {audioInputDevices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Microphone ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Output Device (Speakers) */}
            <div className="mb-4">
              <label className="pc-form-label d-flex align-items-center gap-2">
                <Headphones size={15} className="text-primary" />
                <span>OUTPUT DEVICE (SPEAKERS / HEADPHONES)</span>
              </label>
              <select
                className="form-select pc-input"
                value={selectedAudioOutput}
                onChange={(e) => setSelectedAudioOutput(e.target.value)}
                style={{ backgroundColor: '#1e1f22', borderColor: '#383a40', color: '#fff' }}
              >
                <option value="">Default System Output</option>
                {audioOutputDevices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Speaker ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Mic Test Meter */}
            <div
              className="p-3 rounded"
              style={{ backgroundColor: '#1e1f22', border: '1px solid #383a40' }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="fw-semibold text-white small d-flex align-items-center gap-2">
                  <Activity size={16} className="text-success" />
                  <span>MIC TEST</span>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm ${isTestingMic ? 'btn-danger' : 'btn-primary'} px-3 py-1`}
                  onClick={isTestingMic ? stopMicTest : startMicTest}
                >
                  {isTestingMic ? 'Stop Test' : "Let's Check"}
                </button>
              </div>

              <div className="small text-secondary mb-2" style={{ fontSize: '0.78rem' }}>
                {isTestingMic
                  ? 'Speak into your mic to test volume level.'
                  : 'Test your mic sensitivity before joining a voice channel.'}
              </div>

              {/* Volume Meter Progress Bar */}
              <div
                className="rounded overflow-hidden position-relative"
                style={{ height: '10px', backgroundColor: '#2b2d31' }}
              >
                <div
                  className="h-100 rounded transition-all"
                  style={{
                    width: `${micVolume}%`,
                    backgroundColor: micVolume > 60 ? '#f23f43' : micVolume > 15 ? '#23a55a' : '#5865f2',
                    transition: 'width 0.08s ease-out',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer pc-modal-footer border-0 pt-0">
            <button
              type="button"
              className="btn pc-btn-primary btn-sm px-4"
              onClick={handleClose}
            >
              <Check size={16} className="me-1 inline" />
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
