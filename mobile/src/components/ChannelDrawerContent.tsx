import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import {
  Hash,
  Lock,
  MessageSquare,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react-native';

interface ChannelDrawerContentProps {
  navigation: {
    closeDrawer: () => void;
  };
}

export const ChannelDrawerContent: React.FC<ChannelDrawerContentProps> = ({
  navigation,
}) => {
  const {
    channels,
    activeChannelId,
    setActiveChannel,
    unreadCounts,
    onlineUsers,
  } = useChatStore();

  const { user, logout } = useAuthStore();

  const textChannels = channels.filter(
    (c) => !c.isDirectMessage && !c.IsDirectMessage
  );

  const directMessages = channels.filter(
    (c) => c.isDirectMessage || c.IsDirectMessage
  );

  const handleSelectChannel = (channelId: number) => {
    setActiveChannel(channelId);
    navigation.closeDrawer();
  };

  const getInitials = (name?: string) => {
    return (name || '?').substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Workspace Brand Header */}
        <View style={styles.headerBox}>
          <View style={styles.brandIconBox}>
            <MessageSquare color={colors.text} size={20} />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.headerTitle}>PulseChat</Text>
            <Text style={styles.headerSub}>Real-Time Collaboration</Text>
          </View>
        </View>

        {/* Scrollable Channels & DMs */}
        <ScrollView
          style={styles.scrollSection}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TEXT CHANNELS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CHANNELS</Text>
          </View>

          {textChannels.map((ch) => {
            const isActive = ch.id === activeChannelId;
            const unread = unreadCounts[ch.id] || 0;

            return (
              <TouchableOpacity
                key={ch.id}
                style={[
                  styles.channelRow,
                  isActive && styles.channelRowActive,
                ]}
                onPress={() => handleSelectChannel(ch.id)}
              >
                <View style={styles.channelRowLeft}>
                  {ch.isProtected ? (
                    <Shield color={isActive ? colors.primary : colors.textSecondary} size={18} />
                  ) : ch.isPrivate ? (
                    <Lock color={isActive ? colors.primary : colors.textSecondary} size={18} />
                  ) : (
                    <Hash color={isActive ? colors.primary : colors.textSecondary} size={18} />
                  )}
                  <Text
                    style={[
                      styles.channelName,
                      isActive && styles.channelNameActive,
                      unread > 0 && styles.channelNameUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {ch.name}
                  </Text>
                </View>

                {unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* DIRECT MESSAGES */}
          <View style={[styles.sectionHeader, { marginTop: 22 }]}>
            <Text style={styles.sectionTitle}>DIRECT MESSAGES</Text>
          </View>

          {directMessages.length === 0 ? (
            <Text style={styles.emptyDmMuted}>No direct messages yet</Text>
          ) : (
            directMessages.map((dm) => {
              const isActive = dm.id === activeChannelId;
              const unread = unreadCounts[dm.id] || 0;

              let otherName = dm.name;
              if (dm.members && user) {
                const other = dm.members.find((m) => m.id !== user.id);
                if (other) otherName = other.username;
              }

              const isOnline = onlineUsers.includes(otherName);

              return (
                <TouchableOpacity
                  key={dm.id}
                  style={[
                    styles.channelRow,
                    isActive && styles.channelRowActive,
                  ]}
                  onPress={() => handleSelectChannel(dm.id)}
                >
                  <View style={styles.channelRowLeft}>
                    {/* Online status indicator dot */}
                    <View style={styles.presenceWrapper}>
                      <View style={styles.avatarTiny}>
                        <Text style={styles.avatarTinyText}>
                          {getInitials(otherName)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusDot,
                          isOnline ? styles.dotOnline : styles.dotOffline,
                        ]}
                      />
                    </View>

                    <Text
                      style={[
                        styles.channelName,
                        isActive && styles.channelNameActive,
                        unread > 0 && styles.channelNameUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {otherName}
                    </Text>
                  </View>

                  {unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unread}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Current User Bottom Bar */}
        <View style={styles.userFooter}>
          <View style={styles.userInfoLeft}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {getInitials(user?.username)}
              </Text>
              <View style={[styles.statusDotLarge, styles.dotOnline]} />
            </View>
            <View style={styles.userTexts}>
              <Text style={styles.usernameText} numberOfLines={1}>
                {user?.username || 'User'}
              </Text>
              <Text style={styles.userStatusSub}>Online</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <LogOut color={colors.textSecondary} size={19} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.drawerBackground,
  },
  container: {
    flex: 1,
    backgroundColor: colors.drawerBackground,
  },
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  brandIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSub: {
    color: colors.textMuted,
    fontSize: 11,
  },
  scrollSection: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  sectionHeader: {
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyDmMuted: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 10,
    marginTop: 4,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 1,
  },
  channelRowActive: {
    backgroundColor: colors.primaryLight,
  },
  channelRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  channelName: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  channelNameActive: {
    color: colors.text,
    fontWeight: '700',
  },
  channelNameUnread: {
    color: colors.text,
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: colors.danger,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  presenceWrapper: {
    position: 'relative',
  },
  avatarTiny: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTinyText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: colors.drawerBackground,
  },
  statusDotLarge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.cardBackground,
  },
  dotOnline: {
    backgroundColor: colors.online,
  },
  dotOffline: {
    backgroundColor: colors.offline,
  },
  userFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  userAvatarText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  userTexts: {
    flex: 1,
  },
  usernameText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  userStatusSub: {
    color: colors.online,
    fontSize: 11,
    fontWeight: '500',
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
  },
});
