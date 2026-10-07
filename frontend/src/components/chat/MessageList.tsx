import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
  const {
    messages,
    isLoadingMessages,
    isLoadingMoreMessages,
    hasMoreMessages,
    fetchMessages,
    fetchMoreMessages,
    lastReadMessageIds,
    markChannelAsRead,
  } = useChatStore();
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
  const evaluatedChannelRef = useRef<number | null>(null);

  const hasInitialScrolledRef = useRef(false);
  const isFetchingMoreRef = useRef(false);
  const prevLastMessageIdRef = useRef<number | null>(null);

  const channelMessages = messages[channelId] || [];
  const hasMore = hasMoreMessages[channelId] !== false;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      if (behavior === 'smooth') {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }
  }, []);

  // Reset scroll flags when switching channels
  useEffect(() => {
    hasInitialScrolledRef.current = false;
    isFetchingMoreRef.current = false;
    prevLastMessageIdRef.current = null;
  }, [channelId]);

  // Fetch initial messages for channel if not in store
  useEffect(() => {
    if (messages[channelId] === undefined) {
      fetchMessages(channelId);
    }
  }, [channelId, fetchMessages, messages]);

  // Guaranteed initial scroll to bottom once messages are ready
  useLayoutEffect(() => {
    if (!hasInitialScrolledRef.current && channelMessages.length > 0 && !isLoadingMessages) {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
        hasInitialScrolledRef.current = true;
        prevLastMessageIdRef.current = channelMessages[channelMessages.length - 1]?.id ?? null;

        // Double ensure after any image or layout calculations
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
      }
    }
  }, [channelId, channelMessages, isLoadingMessages]);

  // Load older messages while preserving scroll position
  const handleLoadMore = useCallback(async () => {
    const container = containerRef.current;
    if (
      !container ||
      !hasInitialScrolledRef.current ||
      isFetchingMoreRef.current ||
      isLoadingMoreMessages ||
      !hasMore ||
      channelMessages.length === 0
    ) {
      return;
    }

    isFetchingMoreRef.current = true;
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    try {
      const loaded = await fetchMoreMessages(channelId);
      if (loaded) {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newScrollHeight = containerRef.current.scrollHeight;
            containerRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        });
      }
    } finally {
      setTimeout(() => {
        isFetchingMoreRef.current = false;
      }, 300);
    }
  }, [channelId, channelMessages.length, fetchMoreMessages, hasMore, isLoadingMoreMessages]);

  // Infinite scroll trigger only on deliberate upward user scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || !hasInitialScrolledRef.current) return;

    if (container.scrollTop < 80 && !isLoadingMoreMessages && !isLoadingMessages && hasMore) {
      handleLoadMore();
    }
  }, [handleLoadMore, hasMore, isLoadingMessages, isLoadingMoreMessages]);

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

  // Smart auto-scroll for brand new incoming messages at the bottom
  useEffect(() => {
    if (!hasInitialScrolledRef.current) return;

    const latestMessage = channelMessages[channelMessages.length - 1];
    const latestId = latestMessage?.id ?? null;

    if (latestId !== null && latestId !== prevLastMessageIdRef.current) {
      const isSentByMe = latestMessage?.senderId === user?.id;
      const container = containerRef.current;
      const isNearBottom =
        container &&
        container.scrollHeight - container.scrollTop - container.clientHeight < 250;

      if (isSentByMe || isNearBottom) {
        scrollToBottom('smooth');
      }
      prevLastMessageIdRef.current = latestId;
    }
  }, [channelMessages, scrollToBottom, user?.id]);

  return (
    <div className="chat-messages-container" ref={containerRef} onScroll={handleScroll}>
      {/* Loading older messages indicator at the top */}
      {isLoadingMoreMessages && (
        <div className="d-flex align-items-center justify-content-center py-2 my-1">
          <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
          <span className="text-secondary small fw-medium">Loading older messages...</span>
        </div>
      )}

      {/* Manual button to load older messages if scrolled near top */}
      {!isLoadingMoreMessages && !isLoadingMessages && hasMore && channelMessages.length >= 50 && (
        <div className="text-center py-2 mb-2">
          <button
            type="button"
            onClick={handleLoadMore}
            className="btn btn-sm text-secondary border border-secondary border-opacity-25"
            style={{ fontSize: '0.78rem', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
          >
            Load older messages
          </button>
        </div>
      )}

      {/* Welcome Banner - only shown when at the absolute beginning of channel history */}
      {!hasMore && (
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
      )}

      {isLoadingMessages && channelMessages.length === 0 && (
        <div className="text-center py-4 my-auto">
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
