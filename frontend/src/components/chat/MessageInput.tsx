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

  useEffect(() => {
    // Focus textarea when switching channels
    textareaRef.current?.focus();
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
            className="position-absolute bottom-100 start-0 mb-2 p-2 rounded shadow-lg d-flex flex-wrap gap-2"
            style={{
              backgroundColor: '#1e1f22',
              border: '1px solid #383a40',
              maxWidth: '280px',
              zIndex: 20,
            }}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="btn btn-sm btn-link p-1 text-decoration-none"
                style={{ fontSize: '1.25rem' }}
                onClick={() => addEmoji(emoji)}
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
              type="button"
              className="btn btn-sm btn-link p-1 text-secondary"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
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
