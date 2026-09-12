import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { Smile } from 'lucide-react';
import { sendReaction } from '../../services/signalr';
import { useAuthStore } from '../../store/authStore';

interface MessageItemProps {
  message: Message;
  isUnread?: boolean;
}

const formatTimestamp = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today at ${time}`;
    }
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  } catch {
    return dateStr;
  }
};

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🚀', '🎉', '👀', '💯'];

export const MessageItem: React.FC<MessageItemProps> = ({ message, isUnread }) => {
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { user } = useAuthStore();

  // Close emoji popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowEmojiMenu(false);
      }
    };

    if (showEmojiMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiMenu]);

  const handleToggleReaction = async (emoji: string) => {
    const channelId = message.channelId || message.ChannelId || 1;
    await sendReaction(channelId, message.id, emoji);
    setShowEmojiMenu(false);
  };

  const avatar =
    message.senderAvatarUrl ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${message.senderUsername}&backgroundColor=5865f2`;

  const reactions = message.reactions || {};

  return (
    <div className={`message-item ${isUnread ? 'is-unread' : ''}`}>
      <img src={avatar} alt={message.senderUsername} className="message-avatar" />

      <div className="message-body">
        <div className="d-flex align-items-baseline">
          <span className="message-author">{message.senderUsername}</span>
          <span className="message-timestamp">{formatTimestamp(message.createdAt)}</span>
        </div>
        <div className="message-text">{message.content}</div>

        {/* Real-time Synced Emoji Reaction Pills */}
        {Object.keys(reactions).length > 0 && (
          <div className="d-flex flex-wrap gap-1 mt-2">
            {Object.entries(reactions).map(([emoji, usernames]) => {
              const count = usernames.length;
              const hasUserReacted = Boolean(user && usernames.includes(user.username));

              return (
                <button
                  key={emoji}
                  type="button"
                  className={`reaction-pill ${hasUserReacted ? 'user-reacted' : ''}`}
                  onClick={() => handleToggleReaction(emoji)}
                  title={`${usernames.join(', ')} reacted with ${emoji}`}
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Hover Actions — Completely hidden until message is hovered */}
      <div
        ref={menuRef}
        className={`message-actions ${showEmojiMenu ? 'show-menu' : ''}`}
      >
        <div
          className="d-flex align-items-center gap-1 rounded shadow-sm px-1 py-1"
          style={{
            backgroundColor: '#2b2d31',
            border: '1px solid #383a40',
          }}
        >
          {COMMON_EMOJIS.slice(0, 3).map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="btn btn-sm btn-link p-1 text-decoration-none"
              style={{ fontSize: '0.95rem', lineHeight: 1 }}
              onClick={() => handleToggleReaction(emoji)}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <div className="position-relative">
            <button
              type="button"
              className="btn btn-sm btn-link p-1 text-secondary d-flex align-items-center"
              onClick={() => setShowEmojiMenu(!showEmojiMenu)}
              title="Add Reaction"
            >
              <Smile size={16} />
            </button>

            {showEmojiMenu && (
              <div
                className="position-absolute end-0 bottom-100 mb-2 p-2 rounded shadow-lg d-flex flex-wrap gap-1"
                style={{
                  backgroundColor: '#1e1f22',
                  border: '1px solid #383a40',
                  width: '160px',
                  zIndex: 100,
                }}
              >
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="btn btn-sm btn-link p-1 text-decoration-none"
                    style={{ fontSize: '1.2rem', lineHeight: 1 }}
                    onClick={() => handleToggleReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
