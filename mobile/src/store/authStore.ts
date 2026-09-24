import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { User, LoginData, RegisterData, AuthResponse } from '../types';
import { useChatStore } from './chatStore';
import { stopSignalRConnection } from '../services/signalr';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  quickLogin: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  initAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('pulsechat_token');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false, user: null, token: null });
        return;
      }

      const response = await api.get<User>('/auth/me');
      set({
        user: response.data,
        isAuthenticated: true,
        token,
        isLoading: false,
        error: null,
      });
    } catch {
      await AsyncStorage.removeItem('pulsechat_token');
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
      await AsyncStorage.setItem('pulsechat_token', token);
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

  quickLogin: async (username: string): Promise<void> => {
    const demoPassword = 'Password123!';
    const demoEmail = `${username.toLowerCase()}@pulsechat.local`;

    try {
      // Try login first
      await get().login({
        usernameOrEmail: username,
        password: demoPassword,
      });
    } catch {
      // If user does not exist in DB yet, auto-register
      await get().register({
        username,
        email: demoEmail,
        password: demoPassword,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${username}&backgroundColor=5865f2`,
      });
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);
      const { token, user } = response.data;
      await AsyncStorage.setItem('pulsechat_token', token);
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

  logout: async () => {
    try {
      await stopSignalRConnection();
      await AsyncStorage.removeItem('pulsechat_token');
    } catch {
      // ignore
    }
    useChatStore.getState().resetChat();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));
