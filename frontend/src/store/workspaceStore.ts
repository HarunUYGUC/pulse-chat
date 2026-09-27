import { create } from 'zustand';
import api from '../services/api';
import { Workspace, WorkspaceMember, CreateWorkspaceData, JoinWorkspaceData } from '../types';
import { useChatStore } from './chatStore';
import { useAuthStore } from './authStore';
import { joinWorkspace as signalrJoinWorkspace } from '../services/signalr';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: number | null;
  members: WorkspaceMember[];
  isLoading: boolean;
  error: string | null;

  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (workspaceId: number) => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  fetchWorkspaceMembers: (workspaceId: number) => Promise<void>;
  createWorkspace: (data: CreateWorkspaceData) => Promise<Workspace>;
  joinWorkspace: (data: JoinWorkspaceData) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: number) => Promise<void>;
  removeWorkspace: (workspaceId: number) => void;
  regenerateInviteCode: (workspaceId: number) => Promise<string>;
  leaveWorkspace: (workspaceId: number) => Promise<void>;
  addWorkspace: (workspace: Workspace) => void;
  updateInviteCode: (workspaceId: number, inviteCode: string) => void;
  memberJoined: (workspaceId: number, member: WorkspaceMember, memberCount?: number) => void;
  memberLeft: (workspaceId: number, userId: number, memberCount?: number) => void;
  updateMemberPresence: (username: string, isOnline: boolean) => void;
  incrementWorkspaceUnread: (workspaceId: number) => void;
  decrementWorkspaceUnread: (workspaceId: number, count?: number) => void;
  setWorkspaceUnread: (workspaceId: number, count: number) => void;
  resetWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  members: [],
  isLoading: false,
  error: null,

  resetWorkspace: () =>
    set({
      workspaces: [],
      activeWorkspaceId: null,
      members: [],
      isLoading: false,
      error: null,
    }),

  setWorkspaces: (workspaces) => {
    const map = new Map<number, Workspace>();
    for (const w of workspaces) {
      map.set(Number(w.id), w);
    }
    set({ workspaces: Array.from(map.values()) });
  },

  setActiveWorkspaceId: async (workspaceId: number) => {
    const currentUserId = useAuthStore.getState().user?.id;
    if (currentUserId) {
      localStorage.setItem(`pulsechat_last_workspace_${currentUserId}`, workspaceId.toString());
    }

    set({ activeWorkspaceId: workspaceId });

    // Fetch channels for this workspace
    await useChatStore.getState().fetchChannels(workspaceId);

    // Fetch members for this workspace
    await get().fetchWorkspaceMembers(workspaceId);
  },

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Workspace[]>('/workspaces');
      const workspaces = response.data;
      
      const map = new Map<number, Workspace>();
      for (const w of workspaces) {
        map.set(Number(w.id), w);
      }
      const uniqueWorkspaces = Array.from(map.values());
      
      set({ workspaces: uniqueWorkspaces, isLoading: false });

      if (uniqueWorkspaces.length === 0) {
        set({ activeWorkspaceId: null, members: [] });
        return;
      }

      const currentUserId = useAuthStore.getState().user?.id;
      const storageKey = currentUserId
        ? `pulsechat_last_workspace_${currentUserId}`
        : 'pulsechat_last_workspace';
      const savedWsIdStr = localStorage.getItem(storageKey);
      const savedWsId = savedWsIdStr ? parseInt(savedWsIdStr, 10) : null;

      const currentActive = get().activeWorkspaceId;
      let targetWs: Workspace | undefined;

      if (currentActive && uniqueWorkspaces.some((w) => Number(w.id) === currentActive)) {
        targetWs = uniqueWorkspaces.find((w) => Number(w.id) === currentActive);
      } else if (savedWsId && uniqueWorkspaces.some((w) => Number(w.id) === savedWsId)) {
        targetWs = uniqueWorkspaces.find((w) => Number(w.id) === savedWsId);
      } else {
        targetWs = uniqueWorkspaces[0];
      }

      if (targetWs) {
        await get().setActiveWorkspaceId(targetWs.id);
      }
    } catch (err: unknown) {
      console.error('Failed to load workspaces:', err);
      const axiosError = err as { response?: { data?: { message?: string } } };
      set({
        error: axiosError.response?.data?.message || 'Failed to load workspaces',
        isLoading: false,
      });
    }
  },

  fetchWorkspaceMembers: async (workspaceId: number) => {
    try {
      const response = await api.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
      set({ members: response.data });
    } catch (err) {
      console.error('Failed to load workspace members:', err);
    }
  },

  createWorkspace: async (data: CreateWorkspaceData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Workspace>('/workspaces', data);
      const newWs = response.data;
      get().addWorkspace(newWs);
      set({ isLoading: false });
      await get().setActiveWorkspaceId(newWs.id);
      await signalrJoinWorkspace(newWs.id);
      return newWs;
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message || 'Failed to create workspace.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  joinWorkspace: async (data: JoinWorkspaceData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Workspace>('/workspaces/join', data);
      const joinedWs = response.data;
      get().addWorkspace(joinedWs);
      set({ isLoading: false });
      await get().setActiveWorkspaceId(joinedWs.id);
      await signalrJoinWorkspace(joinedWs.id);
      return joinedWs;
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message || 'Failed to join workspace.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  deleteWorkspace: async (workspaceId: number) => {
    try {
      await api.delete(`/workspaces/${workspaceId}`);
      get().removeWorkspace(workspaceId);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message || 'Failed to delete workspace.';
      throw new Error(message);
    }
  },

  removeWorkspace: (workspaceId: number) => {
    const { workspaces, activeWorkspaceId } = get();
    const remaining = workspaces.filter((w) => Number(w.id) !== Number(workspaceId));
    set({ workspaces: remaining });

    if (activeWorkspaceId === workspaceId) {
      if (remaining.length > 0) {
        get().setActiveWorkspaceId(remaining[0].id);
      } else {
        set({ activeWorkspaceId: null, members: [] });
        useChatStore.getState().setChannels([]);
      }
    }
  },

  regenerateInviteCode: async (workspaceId: number) => {
    try {
      const response = await api.post<{ inviteCode: string }>(
        `/workspaces/${workspaceId}/regenerate-invite`
      );
      const newCode = response.data.inviteCode;
      get().updateInviteCode(workspaceId, newCode);
      return newCode;
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message || 'Failed to regenerate invite code.';
      throw new Error(message);
    }
  },

  leaveWorkspace: async (workspaceId: number) => {
    try {
      await api.post(`/workspaces/${workspaceId}/leave`);
      get().removeWorkspace(workspaceId);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message || 'Failed to leave workspace.';
      throw new Error(message);
    }
  },

  addWorkspace: (workspace: Workspace) => {
    set((state) => {
      const targetId = Number(workspace.id);
      const exists = state.workspaces.some((w) => Number(w.id) === targetId);
      if (exists) {
        return {
          workspaces: state.workspaces.map((w) =>
            Number(w.id) === targetId ? { ...w, ...workspace } : w
          ),
        };
      }
      return { workspaces: [...state.workspaces, workspace] };
    });
  },

  updateInviteCode: (workspaceId: number, inviteCode: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        Number(w.id) === Number(workspaceId) ? { ...w, inviteCode } : w
      ),
    }));
  },

  memberJoined: (workspaceId: number, member: WorkspaceMember, memberCount?: number) => {
    const { activeWorkspaceId, members, workspaces } = get();
    set({
      workspaces: workspaces.map((w) =>
        Number(w.id) === Number(workspaceId)
          ? { ...w, memberCount: memberCount !== undefined ? memberCount : w.memberCount + 1 }
          : w
      ),
    });

    if (activeWorkspaceId === workspaceId) {
      const exists = members.some((m) => Number(m.id) === Number(member.id));
      if (!exists) {
        set({ members: [...members, member] });
      }
    }
  },

  memberLeft: (workspaceId: number, userId: number, memberCount?: number) => {
    const { activeWorkspaceId, members, workspaces } = get();
    set({
      workspaces: workspaces.map((w) =>
        Number(w.id) === Number(workspaceId)
          ? { ...w, memberCount: memberCount !== undefined ? memberCount : Math.max(0, w.memberCount - 1) }
          : w
      ),
    });

    if (activeWorkspaceId === workspaceId) {
      set({ members: members.filter((m) => Number(m.id) !== Number(userId)) });
    }
  },

  updateMemberPresence: (username: string, isOnline: boolean) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.username === username ? { ...m, isOnline } : m
      ),
    }));
  },

  incrementWorkspaceUnread: (workspaceId: number) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        Number(w.id) === Number(workspaceId)
          ? { ...w, unreadCount: (w.unreadCount || 0) + 1 }
          : w
      ),
    }));
  },

  decrementWorkspaceUnread: (workspaceId: number, count = 1) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        Number(w.id) === Number(workspaceId)
          ? { ...w, unreadCount: Math.max(0, (w.unreadCount || 0) - count) }
          : w
      ),
    }));
  },

  setWorkspaceUnread: (workspaceId: number, count: number) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        Number(w.id) === Number(workspaceId)
          ? { ...w, unreadCount: Math.max(0, count) }
          : w
      ),
    }));
  },
}));
