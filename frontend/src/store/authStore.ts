import { create } from 'zustand';
import api from '../services/api';
import { User, LoginData, RegisterData, AuthResponse } from '../types';
import { useChatStore } from './chatStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('pulsechat_token'),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  initAuth: async () => {
    const token = localStorage.getItem('pulsechat_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      const response = await api.get<User>('/auth/me');
      set({
        user: response.data,
        isAuthenticated: true,
        token,
        isLoading: false,
        error: null,
      });
    } catch {
      localStorage.removeItem('pulsechat_token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (data: LoginData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/auth/login', data);
      const { token, user } = response.data;
      localStorage.setItem('pulsechat_token', token);
      localStorage.removeItem(`pulsechat_last_channel_${user.id}`);
      localStorage.removeItem('pulsechat_last_channel');
      useChatStore.getState().resetChat();
      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message =
        axiosError.response?.data?.message || 'Login failed. Please check your credentials.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);
      const { token, user } = response.data;
      localStorage.setItem('pulsechat_token', token);
      localStorage.removeItem(`pulsechat_last_channel_${user.id}`);
      localStorage.removeItem('pulsechat_last_channel');
      useChatStore.getState().resetChat();
      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message =
        axiosError.response?.data?.message || 'Registration failed. Please try again.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: () => {
    const currentUserId = useAuthStore.getState().user?.id;
    if (currentUserId) {
      localStorage.removeItem(`pulsechat_last_channel_${currentUserId}`);
    }
    localStorage.removeItem('pulsechat_last_channel');
    localStorage.removeItem('pulsechat_token');
    useChatStore.getState().resetChat();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));
