import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile } from 'lucide-react';
import { sendMessage, sendTyping } from '../../services/signalr';

interface MessageInputProps {
  channelId: number;
  channelName: string;
  isDm: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🎉', '🚀', '💯', '✨', '👋'];

export const MessageInput: React.FC<MessageInputProps> = ({
  channelId,
  channelName,
  isDm,
}) => {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement | null>(null);

  // Close emoji picker when clicking outside or pressing Escape
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
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
  }, [showEmojiPicker]);

  useEffect(() => {
    // Focus textarea on desktop, avoid mobile keyboard jump & scroll on touch devices
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      textareaRef.current?.focus();
    }
  }, [channelId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);

    // Typing debounce
    if (text.trim().length > 0) {
      sendTyping(channelId, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(channelId, false);
      }, 2500);
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTyping(channelId, false);
    }
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTyping(channelId, false);

    setContent('');
    setShowEmojiPicker(false);

    try {
      await sendMessage(channelId, trimmed);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-box position-relative">
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="emoji-picker-popup"
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="quick-emoji-btn"
                onClick={() => addEmoji(emoji)}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          className="chat-input-textarea"
          placeholder={`Message ${isDm ? '@' : '#'}${channelName}`}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        <div className="d-flex align-items-center justify-content-between pt-1 border-top" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="d-flex align-items-center gap-1">
            <button
              ref={emojiBtnRef}
              type="button"
              className={`emoji-trigger-btn ${showEmojiPicker ? 'active' : ''}`}
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              title="Insert Emoji"
            >
              <Smile size={18} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm pc-btn-primary rounded-circle p-2 d-flex align-items-center justify-content-center"
            style={{ width: '32px', height: '32px' }}
            disabled={!content.trim()}
            onClick={handleSend}
            title="Send Message (Enter)"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
