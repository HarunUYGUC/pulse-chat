import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../../types';
import { Smile } from 'lucide-react';
import { sendReaction } from '../../services/signalr';
import { useAuthStore } from '../../store/authStore';

interface MessageItemProps {
  message: Message;
  isUnread?: boolean;
}

const parseUtcDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  // If it already has Z or timezone offset (+XX:XX or -XX:XX), parse directly
  if (dateStr.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(dateStr)) {
    return new Date(dateStr);
  }
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  return new Date(`${iso}Z`);
};

const formatTimestamp = (dateStr: string) => {
  try {
    const date = parseUtcDate(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    if (isToday) {
      return `Today at ${time}`;
    }
    if (isYesterday) {
      return `Yesterday at ${time}`;
    }

    const isSameYear = date.getFullYear() === now.getFullYear();
    const dateFormatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(isSameYear ? {} : { year: 'numeric' }),
    });

    return `${dateFormatted} at ${time}`;
  } catch {
    return dateStr;
  }
};

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🚀', '🎉', '👀', '💯'];

export const MessageItem: React.FC<MessageItemProps> = ({ message, isUnread }) => {
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { user } = useAuthStore();

  // Close emoji popover on click outside or Escape
  useEffect(() => {
    if (!showEmojiMenu) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowEmojiMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
              className="message-action-emoji"
              onClick={() => handleToggleReaction(emoji)}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          <div className="position-relative">
            <button
              type="button"
              className={`message-action-btn ${showEmojiMenu ? 'active' : ''}`}
              onClick={() => setShowEmojiMenu(!showEmojiMenu)}
              title="Add Reaction"
            >
              <Smile size={16} />
            </button>

            {showEmojiMenu && (
              <div className="reaction-picker-popup">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="reaction-picker-emoji"
                    onClick={() => handleToggleReaction(emoji)}
                    title={`React with ${emoji}`}
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
