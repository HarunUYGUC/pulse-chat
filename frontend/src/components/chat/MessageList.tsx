import React, { useState, useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { Hash, AtSign } from 'lucide-react';

interface MessageListProps {
  channelId: number;
  channelName: string;
  isDm: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  channelId,
  channelName,
  isDm,
}) => {
  const { messages, isLoadingMessages, fetchMessages, lastReadMessageIds, markChannelAsRead } =
    useChatStore();
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
  const evaluatedChannelRef = useRef<number | null>(null);

  const channelMessages = messages[channelId] || [];

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (messages[channelId] === undefined) {
      fetchMessages(channelId);
    }
  }, [channelId, fetchMessages, messages]);

  // Evaluate unread divider once per channel visit
  useEffect(() => {
    if (channelId !== evaluatedChannelRef.current) {
      if (channelMessages.length > 0) {
        evaluatedChannelRef.current = channelId;
        const lastReadId = lastReadMessageIds[channelId];
        const unreadMsg = channelMessages.find(
          (m) => (lastReadId != null && m.id > lastReadId) && m.senderId !== user?.id
        );
        setFirstUnreadId(unreadMsg ? unreadMsg.id : null);

        const latestMsg = channelMessages[channelMessages.length - 1];
        if (latestMsg) {
          markChannelAsRead(channelId, latestMsg.id);
        }
      } else {
        setFirstUnreadId(null);
      }
    }
  }, [channelId, channelMessages, lastReadMessageIds, markChannelAsRead, user?.id]);

  useEffect(() => {
    // Instant scroll on channel switch, smooth scroll on new messages
    scrollToBottom('auto');
  }, [channelId]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [channelMessages.length]);

  return (
    <div className="chat-messages-container">
      {/* Welcome Banner */}
      <div className="mt-auto mb-4 p-3 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
        <div
          className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#2b2d31',
            color: '#fff',
          }}
        >
          {isDm ? <AtSign size={28} /> : <Hash size={28} />}
        </div>
        <h4 className="fw-bold text-white mb-1">
          {isDm ? `This is the start of your conversation with @${channelName}` : `Welcome to #${channelName}!`}
        </h4>
        <p className="text-secondary small mb-0">
          {isDm
            ? 'Messages here are direct and private between the two of you.'
            : `This is the start of the #${channelName} channel.`}
        </p>
      </div>

      {isLoadingMessages && (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm text-secondary" role="status" />
          <div className="text-secondary small mt-2">Loading messages...</div>
        </div>
      )}

      {/* Message Items */}
      {channelMessages.map((msg) => (
        <React.Fragment key={msg.id}>
          {firstUnreadId === msg.id && (
            <div className="new-messages-divider">
              <span className="new-messages-badge">NEW MESSAGES</span>
            </div>
          )}
          <MessageItem
            message={msg}
            isUnread={firstUnreadId !== null && msg.id >= firstUnreadId && msg.senderId !== user?.id}
          />
        </React.Fragment>
      ))}

      {/* Auto-scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};
