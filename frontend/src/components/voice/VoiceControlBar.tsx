import React from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Settings,
  VolumeX,
  Radio,
} from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';
import { useChatStore } from '../../store/chatStore';

export const VoiceControlBar: React.FC = () => {
  const {
    activeVoiceChannelId,
    connectionStatus,
    isMuted,
    isDeafened,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    setSettingsOpen,
  } = useVoiceStore();

  const { channels } = useChatStore();

  if (!activeVoiceChannelId) return null;

  const currentChannel = channels.find((c) => c.id === activeVoiceChannelId);
  const channelName = currentChannel?.name || 'Voice Room';

  const isConnecting = connectionStatus === 'connecting';
  const isConnected = connectionStatus === 'connected';

  return (
    <div
      className="p-2 border-top"
      style={{
        backgroundColor: '#111214',
        borderColor: '#2b2d31',
        userSelect: 'none',
      }}
    >
      {/* Top row: Status & Disconnect button */}
      <div className="d-flex align-items-center justify-content-between mb-1">
        <div className="d-flex align-items-center gap-2 text-truncate" style={{ minWidth: 0 }}>
          <div
            className="d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              color: isConnected ? '#23a55a' : isConnecting ? '#f0b232' : '#f23f43',
            }}
          >
            <Radio size={16} className={isConnecting ? 'animate-pulse' : ''} />
          </div>
          <div className="text-truncate">
            <div
              className="fw-bold text-truncate"
              style={{
                fontSize: '0.75rem',
                color: isConnected ? '#23a55a' : isConnecting ? '#f0b232' : '#f23f43',
                lineHeight: 1.2,
              }}
            >
              {isConnecting ? 'Connecting...' : isConnected ? 'Voice Connected' : 'Voice Error'}
            </div>
            <div
              className="text-white small text-truncate"
              style={{ fontSize: '0.72rem', color: '#949ba4' }}
              title={channelName}
            >
              🔊 {channelName}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-sm p-1 rounded-circle d-flex align-items-center justify-content-center"
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'rgba(242, 63, 67, 0.15)',
            color: '#f23f43',
            border: 'none',
            transition: 'background-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f23f43';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(242, 63, 67, 0.15)';
            e.currentTarget.style.color = '#f23f43';
          }}
          onClick={leaveVoice}
          title="Disconnect Voice"
        >
          <PhoneOff size={15} />
        </button>
      </div>

      {/* Bottom row: Controls (Mute, Deafen, Settings) */}
      <div className="d-flex align-items-center justify-content-around pt-1 border-top" style={{ borderColor: '#1e1f22' }}>
        {/* Mute Button */}
        <button
          type="button"
          className="btn btn-sm btn-link p-1 d-flex align-items-center justify-content-center rounded"
          style={{
            color: isMuted ? '#f23f43' : '#b5bac1',
            textDecoration: 'none',
            width: '32px',
            height: '32px',
          }}
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={17} /> : <Mic size={17} />}
        </button>

        {/* Deafen Button */}
        <button
          type="button"
          className="btn btn-sm btn-link p-1 d-flex align-items-center justify-content-center rounded"
          style={{
            color: isDeafened ? '#f23f43' : '#b5bac1',
            textDecoration: 'none',
            width: '32px',
            height: '32px',
          }}
          onClick={toggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          {isDeafened ? <VolumeX size={17} /> : <Headphones size={17} />}
        </button>

        {/* Voice Settings Button */}
        <button
          type="button"
          className="btn btn-sm btn-link p-1 d-flex align-items-center justify-content-center rounded"
          style={{
            color: '#b5bac1',
            textDecoration: 'none',
            width: '32px',
            height: '32px',
          }}
          onClick={() => setSettingsOpen(true)}
          title="Voice Settings"
        >
          <Settings size={17} />
        </button>
      </div>
    </div>
  );
};
