import { create } from "zustand";
import { api, ApiError } from "./api";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  loyaltyPoints: number;
}

interface AuthState {
  user: AuthUser | null;
  initialized: boolean;
  loading: boolean;
  fetchMe: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: { phone: string; password: string; firstName: string; lastName?: string; email?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { firstName?: string; lastName?: string | null; email?: string | null }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  loading: false,

  fetchMe: async () => {
    try {
      const { user } = await api.get<{ user: AuthUser }>("/api/auth/me");
      set({ user, initialized: true });
    } catch {
      set({ user: null, initialized: true });
    }
  },

  login: async (phone, password) => {
    set({ loading: true });
    try {
      const { user } = await api.post<{ user: AuthUser }>("/api/auth/login", { phone, password });
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const { user } = await api.post<{ user: AuthUser }>("/api/auth/register", data);
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await api.post("/api/auth/logout");
    set({ user: null });
  },

  updateProfile: async (data) => {
    const { user } = await api.put<{ user: AuthUser }>("/api/auth/me", data);
    set({ user });
  },

  changePassword: async (currentPassword, newPassword) => {
    const { user } = await api.post<{ user: AuthUser }>("/api/auth/change-password", { currentPassword, newPassword });
    set({ user });
  },
}));

export { ApiError };
