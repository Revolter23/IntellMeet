import { create } from 'zustand';
import axios from 'axios';
import { API_BASE_URL } from '../lib/config';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  systemRole?: 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'MEDIA_MANAGER' | 'PLATFORM_USER';
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isCheckingAuth: boolean;
  setAuth: (accessToken: string, user: User) => void;
  clearAuth: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
}

const authAxios = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  withCredentials: true,
});

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isCheckingAuth: true,

  setAuth: (accessToken, user) => set({ accessToken, user }),

  clearAuth: () => set({ accessToken: null, user: null }),

  updateUser: (user) => set({ user }),

  checkAuth: async () => {
    try {
      const response = await authAxios.post('/refresh');
      const { accessToken, user } = response.data;
      set({ accessToken, user, isCheckingAuth: false });
    } catch (error) {
      set({ accessToken: null, user: null, isCheckingAuth: false });
    }
  },
}));
