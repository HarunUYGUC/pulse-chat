import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { MessageItem } from '../../components/MessageItem';
import { MessageInput } from '../../components/MessageInput';
import { TypingBar } from '../../components/TypingBar';
import { Menu, Hash, Shield, Lock } from 'lucide-react-native';
import { Message } from '../../types';

interface ChatScreenProps {
  navigation: {
    openDrawer: () => void;
  };
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ navigation }) => {
  const {
    channels,
    activeChannelId,
    messages,
    typingUsers,
    lastReadMessageIds,
    isLoadingMessages,
    markChannelAsRead,
  } = useChatStore();

  const { user: currentUser } = useAuthStore();

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const channelMessages = useMemo(() => {
    return activeChannelId ? messages[activeChannelId] || [] : [];
  }, [messages, activeChannelId]);

  const activeTyping = useMemo(() => {
    if (!activeChannelId) return [];
    const list = typingUsers[activeChannelId] || [];
    return list.filter((u) => u !== currentUser?.username);
  }, [typingUsers, activeChannelId, currentUser]);

  // Mark channel as read when opened or new messages arrive
  useEffect(() => {
    if (activeChannelId && channelMessages.length > 0) {
      const lastMsg = channelMessages[channelMessages.length - 1];
      markChannelAsRead(activeChannelId, lastMsg.id);
    }
  }, [activeChannelId, channelMessages.length]);

  // Determine display name
  const isDm = Boolean(activeChannel?.isDirectMessage || activeChannel?.IsDirectMessage);
  let displayName = activeChannel?.name || 'general';
  if (isDm && activeChannel?.members && currentUser) {
    const other = activeChannel.members.find((m) => m.id !== currentUser.id);
    if (other) displayName = other.username;
  }

  // Find first unread message ID for red divider
  const lastReadId = activeChannelId ? lastReadMessageIds[activeChannelId] : null;
  const firstUnread = channelMessages.find(
    (m) => lastReadId != null && m.id > lastReadId && m.senderId !== currentUser?.id
  );
  const firstUnreadId = firstUnread?.id ?? null;

  // Inverted FlatList for native messaging performance
  const reversedMessages = useMemo(() => {
    return [...channelMessages].reverse();
  }, [channelMessages]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Top Channel Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.openDrawer()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu color={colors.text} size={24} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              {isDm ? null : activeChannel?.isProtected ? (
                <Shield color={colors.textSecondary} size={18} style={styles.headerIcon} />
              ) : activeChannel?.isPrivate ? (
                <Lock color={colors.textSecondary} size={18} style={styles.headerIcon} />
              ) : (
                <Hash color={colors.textSecondary} size={18} style={styles.headerIcon} />
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            {activeChannel?.description ? (
              <Text style={styles.headerTopic} numberOfLines={1}>
                {activeChannel.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Message Feed Area */}
        <View style={styles.feedContainer}>
          {isLoadingMessages && channelMessages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : channelMessages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Hash color={colors.textSecondary} size={40} />
              </View>
              <Text style={styles.emptyTitle}>Welcome to #{displayName}!</Text>
              <Text style={styles.emptySub}>
                This is the start of the #{displayName} channel. Say hello!
              </Text>
            </View>
          ) : (
            <FlatList
              data={reversedMessages}
              keyExtractor={(item) => String(item.id)}
              inverted
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <MessageItem
                  message={item}
                  channelId={activeChannelId || 1}
                  isUnread={firstUnreadId !== null && item.id === firstUnreadId}
                />
              )}
            />
          )}
        </View>

        {/* Typing Notification Bar */}
        <TypingBar typingUsers={activeTyping} />

        {/* Message Input Box */}
        {activeChannelId && (
          <MessageInput
            channelId={activeChannelId}
            channelName={displayName}
            isDm={isDm}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.headerBackground,
  },
  container: {
    flex: 1,
    backgroundColor: colors.cardBackground,
  },
  headerBar: {
    height: 54,
    backgroundColor: colors.headerBackground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuButton: {
    marginRight: 14,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 6,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerTopic: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  feedContainer: {
    flex: 1,
    backgroundColor: colors.cardBackground,
  },
  listContent: {
    paddingVertical: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.drawerBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
