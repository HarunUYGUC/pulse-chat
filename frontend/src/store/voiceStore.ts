import { create } from 'zustand';
import { VoiceParticipant } from '../types';
import {
  joinVoiceChannel as hubJoinVoice,
  leaveVoiceChannel as hubLeaveVoice,
  toggleVoiceState as hubToggleVoice,
} from '../services/signalr';
import { webrtcService } from '../services/webrtcService';
import {
  playJoinSound,
  playLeaveSound,
  playMuteSound,
  playUnmuteSound,
} from '../services/soundEffects';

interface VoiceState {
  activeVoiceChannelId: number | null;
  voiceParticipants: Record<number, VoiceParticipant[]>;
  isMuted: boolean;
  isDeafened: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  speakingUsers: number[];
  isSettingsOpen: boolean;
  selectedAudioInput: string;
  selectedAudioOutput: string;
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];

  // Actions
  joinVoice: (channelId: number) => Promise<void>;
  leaveVoice: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setSpeaking: (userId: number, isSpeaking: boolean) => void;
  clearAllSpeaking: () => void;
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  setParticipants: (channelId: number, participants: VoiceParticipant[]) => void;
  addParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (channelId: number, userId: number, connectionId: string) => void;
  updateParticipantState: (channelId: number, userId: number, isMuted: boolean, isDeafened: boolean) => void;
  setAllVoiceParticipants: (all: Record<number, VoiceParticipant[]>) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  refreshAudioDevices: () => Promise<void>;
  setSelectedAudioInput: (deviceId: string) => Promise<void>;
  setSelectedAudioOutput: (deviceId: string) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  activeVoiceChannelId: null,
  voiceParticipants: {},
  isMuted: false,
  isDeafened: false,
  connectionStatus: 'disconnected',
  speakingUsers: [],
  isSettingsOpen: false,
  selectedAudioInput: '',
  selectedAudioOutput: '',
  audioInputDevices: [],
  audioOutputDevices: [],

  joinVoice: async (channelId: number) => {
    const currentActive = get().activeVoiceChannelId;
    if (currentActive === channelId && get().connectionStatus === 'connected') {
      return;
    }

    if (currentActive) {
      await get().leaveVoice();
    }

    set({ activeVoiceChannelId: channelId, connectionStatus: 'connecting' });

    try {
      playJoinSound();

      // Start local microphone stream
      await webrtcService.startLocalAudio(get().selectedAudioInput);

      // Signal join to SignalR hub with initial mute/deafen states
      const { isMuted, isDeafened } = get();
      await hubJoinVoice(channelId, isMuted, isDeafened);
    } catch (err) {
      console.error('Failed to join voice channel:', err);
      set({ connectionStatus: 'error' });
    }
  },

  leaveVoice: async () => {
    const activeId = get().activeVoiceChannelId;
    if (!activeId) return;

    try {
      playLeaveSound();
      await hubLeaveVoice(activeId);
    } catch (err) {
      console.warn('Error during leave voice hub call:', err);
    } finally {
      webrtcService.stopAll();
      set({
        activeVoiceChannelId: null,
        connectionStatus: 'disconnected',
        speakingUsers: [],
        isMuted: false,
        isDeafened: false,
      });
    }
  },

  toggleMute: () => {
    const newMuted = !get().isMuted;
    set({ isMuted: newMuted });

    if (newMuted) {
      playMuteSound();
    } else {
      playUnmuteSound();
    }

    webrtcService.setMute(newMuted);

    const activeId = get().activeVoiceChannelId;
    if (activeId) {
      hubToggleVoice(activeId, newMuted, get().isDeafened).catch(() => {});
    }
  },

  toggleDeafen: () => {
    const newDeafened = !get().isDeafened;
    // If deafened, automatically mute as well
    const newMuted = newDeafened ? true : get().isMuted;

    set({ isDeafened: newDeafened, isMuted: newMuted });

    if (newDeafened) {
      playMuteSound();
    } else {
      playUnmuteSound();
    }

    webrtcService.setDeafen(newDeafened);
    webrtcService.setMute(newMuted);

    const activeId = get().activeVoiceChannelId;
    if (activeId) {
      hubToggleVoice(activeId, newMuted, newDeafened).catch(() => {});
    }
  },

  setSpeaking: (userId: number, isSpeaking: boolean) => {
    set((state) => {
      const exists = state.speakingUsers.includes(userId);
      if (isSpeaking && !exists) {
        return { speakingUsers: [...state.speakingUsers, userId] };
      } else if (!isSpeaking && exists) {
        return { speakingUsers: state.speakingUsers.filter((id) => id !== userId) };
      }
      return state;
    });
  },

  clearAllSpeaking: () => {
    set({ speakingUsers: [] });
  },

  setConnectionStatus: (status) => {
    set({ connectionStatus: status });
  },

  setParticipants: (channelId: number, participants: VoiceParticipant[]) => {
    set((state) => ({
      voiceParticipants: {
        ...state.voiceParticipants,
        [channelId]: participants,
      },
    }));
  },

  addParticipant: (participant: VoiceParticipant) => {
    set((state) => {
      const currentList = state.voiceParticipants[participant.channelId] || [];
      const filtered = currentList.filter((p) => p.userId !== participant.userId && p.connectionId !== participant.connectionId);
      return {
        voiceParticipants: {
          ...state.voiceParticipants,
          [participant.channelId]: [...filtered, participant],
        },
      };
    });
  },

  removeParticipant: (channelId: number, userId: number, connectionId: string) => {
    webrtcService.removePeer(connectionId, userId);

    set((state) => {
      const currentList = state.voiceParticipants[channelId] || [];
      const updated = currentList.filter((p) => p.connectionId !== connectionId && p.userId !== userId);
      return {
        voiceParticipants: {
          ...state.voiceParticipants,
          [channelId]: updated,
        },
        speakingUsers: state.speakingUsers.filter((id) => id !== userId),
      };
    });
  },

  updateParticipantState: (channelId: number, userId: number, isMuted: boolean, isDeafened: boolean) => {
    set((state) => {
      const currentList = state.voiceParticipants[channelId] || [];
      const updated = currentList.map((p) =>
        p.userId === userId ? { ...p, isMuted, isDeafened } : p
      );
      return {
        voiceParticipants: {
          ...state.voiceParticipants,
          [channelId]: updated,
        },
      };
    });
  },

  setAllVoiceParticipants: (all: Record<number, VoiceParticipant[]>) => {
    set({ voiceParticipants: all });
  },

  setSettingsOpen: (isOpen: boolean) => {
    set({ isSettingsOpen: isOpen });
    if (isOpen) {
      get().refreshAudioDevices();
    }
  },

  refreshAudioDevices: async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      set({ audioInputDevices: inputs, audioOutputDevices: outputs });
    } catch (err) {
      console.warn('Failed to enumerate audio devices:', err);
    }
  },

  setSelectedAudioInput: async (deviceId: string) => {
    set({ selectedAudioInput: deviceId });
    if (get().activeVoiceChannelId) {
      await webrtcService.startLocalAudio(deviceId);
    }
  },

  setSelectedAudioOutput: (deviceId: string) => {
    set({ selectedAudioOutput: deviceId });
  },
}));
