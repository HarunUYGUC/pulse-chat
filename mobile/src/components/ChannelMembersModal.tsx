import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Users, MessageSquare } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { Channel, User } from '../types';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface ChannelMembersModalProps {
  visible: boolean;
  onClose: () => void;
  channel: Channel | undefined;
}

export const ChannelMembersModal: React.FC<ChannelMembersModalProps> = ({
  visible,
  onClose,
  channel,
}) => {
  const { onlineUsers, addChannel, setActiveChannel } = useChatStore();
  const { user: currentUser } = useAuthStore();

  if (!channel) return null;

  const members = channel.members || [];
  const onlineMembers: User[] = [];
  const offlineMembers: User[] = [];

  members.forEach((m) => {
    if (onlineUsers.includes(m.username)) {
      onlineMembers.push(m);
    } else {
      offlineMembers.push(m);
    }
  });

  const handleMemberPress = async (member: User) => {
    if (member.id === currentUser?.id) return;

    try {
      const res = await api.post<Channel>('/channels/dm', {
        targetUserId: member.id,
      });
      addChannel(res.data);
      setActiveChannel(res.data.id);
      onClose();
    } catch (err) {
      console.error('Failed to open DM:', err);
    }
  };

  const renderSection = (title: string, list: User[], isOnline: boolean) => {
    if (list.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {title.toUpperCase()} — {list.length}
        </Text>
        {list.map((m) => {
          const isSelf = m.id === currentUser?.id;
          const avatarUrl =
            m.avatarUrl ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${m.username}&backgroundColor=5865f2`;

          return (
            <TouchableOpacity
              key={m.id}
              style={styles.memberRow}
              onPress={() => handleMemberPress(m)}
              disabled={isSelf}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <View
                  style={[
                    styles.statusDot,
                    isOnline ? styles.statusOnline : styles.statusOffline,
                  ]}
                />
              </View>

              <View style={styles.nameContainer}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.username}
                </Text>
                {isSelf && <Text style={styles.selfBadge}>(you)</Text>}
              </View>

              {!isSelf && (
                <View style={styles.dmAction}>
                  <MessageSquare color={colors.textMuted} size={16} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Users color={colors.textSecondary} size={20} style={styles.headerIcon} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                #{channel.name} Members ({members.length})
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X color={colors.textSecondary} size={22} />
            </TouchableOpacity>
          </View>

          {/* Members List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderSection('Online', onlineMembers, true)}
            {renderSection('Offline', offlineMembers, false)}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: '40%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBackground,
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.cardBackground,
  },
  statusOnline: {
    backgroundColor: colors.online,
  },
  statusOffline: {
    backgroundColor: colors.offline,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  selfBadge: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: 6,
  },
  dmAction: {
    padding: 6,
  },
});
