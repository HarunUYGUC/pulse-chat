import React from 'react';
import { useChatStore } from '../../store/chatStore';

export const TypingIndicator: React.FC = () => {
  const { activeChannelId, typingUsers } = useChatStore();

  if (!activeChannelId) return null;

  const users = typingUsers[activeChannelId] || [];

  if (users.length === 0) {
    return <div style={{ height: '22px' }} />;
  }

  let text = '';
  if (users.length === 1) {
    text = `${users[0]} is typing...`;
  } else if (users.length === 2) {
    text = `${users[0]} and ${users[1]} are typing...`;
  } else {
    text = 'Several people are typing...';
  }

  return (
    <div
      className="d-flex align-items-center text-secondary small px-1"
      style={{ height: '22px', fontSize: '0.78rem', fontStyle: 'italic' }}
    >
      <span>{text}</span>
      <span className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
    </div>
  );
};
