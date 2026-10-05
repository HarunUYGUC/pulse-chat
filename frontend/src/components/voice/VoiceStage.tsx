import React from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Settings,
  VolumeX,
  Volume2,
  Users,
  LogIn,
  Lock,
} from 'lucide-react';
import { useVoiceStore } from '../../store/voiceStore';
import { useAuthStore } from '../../store/authStore';
import { Channel } from '../../types';

interface VoiceStageProps {
  channel: Channel;
}

export const VoiceStage: React.FC<VoiceStageProps> = ({ channel }) => {
  const { user: currentUser } = useAuthStore();
  const {
    activeVoiceChannelId,
    voiceParticipants,
    isMuted,
    isDeafened,
    speakingUsers,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    setSettingsOpen,
  } = useVoiceStore();

  const isConnectedToThisChannel = activeVoiceChannelId === channel.id;
  const isPrivate = Boolean(channel.isPrivate);
  const participants = voiceParticipants[channel.id] || [];

  return (
    <div
      className="d-flex flex-column flex-grow-1 h-100 overflow-hidden"
      style={{ backgroundColor: '#1e1f22' }}
    >
      {/* Top Banner / Channel Info */}
      <div
        className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between flex-shrink-0"
        style={{ borderColor: 'var(--pc-border)', backgroundColor: '#2b2d31' }}
      >
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center position-relative"
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'rgba(88, 101, 242, 0.15)',
              color: 'var(--pc-primary)',
            }}
          >
            <Volume2 size={22} />
            {isPrivate && (
              <Lock
                size={12}
                className="position-absolute text-warning"
                style={{ bottom: '2px', right: '2px', strokeWidth: 2.8 }}
              />
            )}
          </div>
          <div>
            <h5 className="fw-bold text-white mb-0 d-flex align-items-center gap-2">
              <span>{channel.name}</span>
              {isPrivate && (
                <span
                  className="badge rounded-pill d-inline-flex align-items-center gap-1"
                  style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                    color: '#facc15',
                    fontSize: '0.72rem',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    fontWeight: 500,
                  }}
                >
                  <Lock size={10} />
                  Private Room
                </span>
              )}
            </h5>
            <div className="small text-secondary mt-0" style={{ fontSize: '0.8rem' }}>
              {channel.description || 'Voice lounge for team discussions and hangouts.'}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center gap-1 px-3 py-1 rounded-pill small fw-semibold"
            style={{ backgroundColor: '#1e1f22', color: '#b5bac1' }}
          >
            <Users size={15} />
            <span>{participants.length} Connected</span>
          </div>
        </div>
      </div>

      {/* Main Grid Canvas of Participants */}
      <div className="flex-grow-1 p-4 overflow-y-auto d-flex flex-column justify-content-center">
        {participants.length === 0 ? (
          <div className="text-center py-5">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{
                width: '72px',
                height: '72px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#949ba4',
              }}
            >
              <Volume2 size={36} />
            </div>
            <h4 className="fw-bold text-white mb-1">No one is here yet</h4>
            <p className="text-secondary small mb-4" style={{ maxWidth: '380px', margin: '0 auto' }}>
              Join the voice channel to start talking with your team.
            </p>

            {!isConnectedToThisChannel && (
              <button
                type="button"
                className="btn pc-btn-primary px-4 py-2 d-inline-flex align-items-center gap-2 shadow"
                onClick={() => joinVoice(channel.id)}
              >
                <LogIn size={18} />
                <span>Join Voice</span>
              </button>
            )}
          </div>
        ) : (
          <div
            className="d-grid gap-4"
            style={{
              gridTemplateColumns:
                participants.length === 1
                  ? 'minmax(260px, 420px)'
                  : participants.length <= 4
                  ? 'repeat(auto-fit, minmax(240px, 1fr))'
                  : 'repeat(auto-fill, minmax(200px, 1fr))',
              justifyContent: 'center',
              alignContent: 'center',
              maxWidth: '1100px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            {participants.map((p) => {
              const isSpeaking = speakingUsers.includes(p.userId);
              const isSelf = p.userId === currentUser?.id;
              const effectiveMuted = isSelf ? isMuted : p.isMuted;
              const effectiveDeafened = isSelf ? isDeafened : p.isDeafened;

              return (
                <div
                  key={p.connectionId || p.userId}
                  className="rounded-4 p-4 d-flex flex-column align-items-center justify-content-center position-relative transition-all shadow-sm"
                  style={{
                    backgroundColor: '#2b2d31',
                    minHeight: '190px',
                    border: isSpeaking
                      ? '2px solid #23a55a'
                      : '2px solid transparent',
                    boxShadow: isSpeaking
                      ? '0 0 0 2px rgba(35, 165, 90, 0.4), 0 0 20px rgba(35, 165, 90, 0.35)'
                      : 'none',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  {/* Status Badges in top right */}
                  <div className="position-absolute top-0 end-0 m-3 d-flex align-items-center gap-1">
                    {effectiveMuted && (
                      <div
                        className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: 'rgba(242, 63, 67, 0.2)', color: '#f23f43' }}
                        title="Muted"
                      >
                        <MicOff size={14} />
                      </div>
                    )}
                    {effectiveDeafened && (
                      <div
                        className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: 'rgba(242, 63, 67, 0.2)', color: '#f23f43' }}
                        title="Deafened"
                      >
                        <VolumeX size={14} />
                      </div>
                    )}
                  </div>

                  {/* Avatar with speaking glow */}
                  <div className="position-relative mb-3">
                    <img
                      src={
                        p.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${p.username}&backgroundColor=5865f2`
                      }
                      alt={p.username}
                      className="rounded-circle"
                      style={{
                        width: '84px',
                        height: '84px',
                        objectFit: 'cover',
                        border: isSpeaking ? '3px solid #23a55a' : '3px solid #1e1f22',
                        transition: 'border-color 0.15s ease',
                      }}
                    />
                  </div>

                  {/* Username */}
                  <div className="fw-bold text-white text-truncate text-center" style={{ fontSize: '0.95rem', maxWidth: '180px' }}>
                    {p.username} {isSelf && <span className="text-secondary fw-normal small">(You)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Stage Control Bar */}
      <div
        className="p-3 border-top d-flex align-items-center justify-content-center gap-3 flex-shrink-0"
        style={{
          backgroundColor: '#111214',
          borderColor: 'var(--pc-border)',
        }}
      >
        {isConnectedToThisChannel ? (
          <>
            {/* Mute Button */}
            <button
              type="button"
              className={`btn btn-lg rounded-circle d-flex align-items-center justify-content-center shadow ${
                isMuted ? 'btn-danger' : 'btn-secondary'
              }`}
              style={{ width: '52px', height: '52px' }}
              onClick={toggleMute}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Deafen Button */}
            <button
              type="button"
              className={`btn btn-lg rounded-circle d-flex align-items-center justify-content-center shadow ${
                isDeafened ? 'btn-danger' : 'btn-secondary'
              }`}
              style={{ width: '52px', height: '52px' }}
              onClick={toggleDeafen}
              title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
            >
              {isDeafened ? <VolumeX size={22} /> : <Headphones size={22} />}
            </button>

            {/* Voice Settings Button */}
            <button
              type="button"
              className="btn btn-lg btn-secondary rounded-circle d-flex align-items-center justify-content-center shadow"
              style={{ width: '52px', height: '52px', backgroundColor: '#313338' }}
              onClick={() => setSettingsOpen(true)}
              title="Voice Settings"
            >
              <Settings size={22} />
            </button>

            {/* Disconnect Button */}
            <button
              type="button"
              className="btn btn-lg btn-danger rounded-circle d-flex align-items-center justify-content-center shadow"
              style={{ width: '52px', height: '52px', backgroundColor: '#da373c' }}
              onClick={leaveVoice}
              title="Disconnect Voice"
            >
              <PhoneOff size={22} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn pc-btn-primary px-4 py-2 d-flex align-items-center gap-2 shadow rounded-pill"
            onClick={() => joinVoice(channel.id)}
          >
            <LogIn size={18} />
            <span>Join Voice Channel</span>
          </button>
        )}
      </div>
    </div>
  );
};
