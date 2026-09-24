import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Message } from '../types';
import { colors } from '../theme/colors';
import { sendReaction } from '../services/signalr';
import { useAuthStore } from '../store/authStore';
import { Smile } from 'lucide-react-native';

interface MessageItemProps {
  message: Message;
  channelId: number;
  isUnread?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🚀', '🎉', '👀', '💯'];

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

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  channelId,
  isUnread,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { user: currentUser } = useAuthStore();

  const handleToggleReaction = async (emoji: string) => {
    setShowEmojiPicker(false);
    await sendReaction(channelId, message.id, emoji);
  };

  const getInitials = (name: string) => {
    return (name || '?').substring(0, 2).toUpperCase();
  };

  const isSelf = message.senderId === currentUser?.id;

  return (
    <View style={styles.outerContainer}>
      {/* Visual unread divider if first unread message */}
      {isUnread && (
        <View style={styles.unreadDividerContainer}>
          <View style={styles.unreadDividerLine} />
          <Text style={styles.unreadDividerText}>NEW MESSAGES</Text>
          <View style={styles.unreadDividerLine} />
        </View>
      )}

      <View style={[styles.messageRow, isSelf && styles.messageRowSelf]}>
        {/* User Avatar Circle */}
        <View
          style={[
            styles.avatarCircle,
            isSelf ? styles.avatarSelf : styles.avatarOther,
          ]}
        >
          <Text style={styles.avatarText}>
            {getInitials(message.senderUsername)}
          </Text>
        </View>

        {/* Message Bubble & Content */}
        <View style={styles.contentColumn}>
          {/* Header: Author + Timestamp */}
          <View style={styles.headerRow}>
            <Text style={[styles.authorName, isSelf && styles.authorNameSelf]}>
              {message.senderUsername}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(message.createdAt)}
            </Text>
            <TouchableOpacity
              style={styles.addReactionIcon}
              onPress={() => setShowEmojiPicker(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Smile color={colors.textSecondary} size={15} />
            </TouchableOpacity>
          </View>

          {/* Text Bubble */}
          <View
            style={[
              styles.bubble,
              isSelf ? styles.bubbleSelf : styles.bubbleOther,
            ]}
          >
            <Text style={styles.messageText}>{message.content}</Text>
          </View>

          {/* Reactions Row */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <View style={styles.reactionsRow}>
              {Object.entries(message.reactions).map(([emoji, users]) => {
                if (!users || users.length === 0) return null;
                const userReacted = currentUser && users.includes(currentUser.username);

                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.reactionPill,
                      userReacted && styles.reactionPillActive,
                    ]}
                    onPress={() => handleToggleReaction(emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text
                      style={[
                        styles.reactionCount,
                        userReacted && styles.reactionCountActive,
                      ]}
                    >
                      {users.length}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEmojiPicker(false)}
        >
          <View style={styles.emojiPickerCard}>
            <Text style={styles.emojiPickerTitle}>Add Reaction</Text>
            <View style={styles.emojiGrid}>
              {COMMON_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => handleToggleReaction(emoji)}
                >
                  <Text style={styles.emojiLarge}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  unreadDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  unreadDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.dividerUnread,
  },
  unreadDividerText: {
    color: colors.dividerUnread,
    fontSize: 10,
    fontWeight: 'bold',
    marginHorizontal: 8,
    letterSpacing: 0.5,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageRowSelf: {
    // Left aligned matching Discord/Slack multi-user feed, or slight tint
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  avatarSelf: {
    backgroundColor: colors.primary,
  },
  avatarOther: {
    backgroundColor: '#3f4147',
  },
  avatarText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  contentColumn: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  authorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  authorNameSelf: {
    color: '#8ea1e1',
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  addReactionIcon: {
    padding: 2,
    opacity: 0.7,
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '96%',
  },
  bubbleOther: {
    backgroundColor: colors.bubbleOther,
  },
  bubbleSelf: {
    backgroundColor: colors.bubbleSelf,
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.drawerBackground,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  reactionPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  reactionCountActive: {
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emojiPickerCard: {
    backgroundColor: colors.drawerBackground,
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiPickerTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  emojiBtn: {
    padding: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
  },
  emojiLarge: {
    fontSize: 26,
  },
});
