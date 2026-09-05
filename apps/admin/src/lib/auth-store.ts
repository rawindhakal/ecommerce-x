import { create } from "zustand";
import { api } from "./api";

export interface AuthUser {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "POS_CASHIER";
}

interface AuthState {
  user: AuthUser | null;
  initialized: boolean;
  loading: boolean;
  fetchMe: () => Promise<void>;
  login: (phone: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
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
      const { user } = await api.post<{ user: AuthUser }>("/api/auth/staff-login", { phone, password });
      set({ user, initialized: true });
      return user;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await api.post("/api/auth/logout");
    set({ user: null });
  },
}));
