import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ApiError,
  apiUserToAppUser,
  getCurrentUser,
  listUsers,
  loginUser,
  registerUser,
  updateUser,
} from '@/api/client';
import type { AppUser, UserRole } from '@/types';
import { clearToken, getToken, setToken } from '@/utils/tokenStorage';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  password: string;
  unitNumber?: string;
  building?: string;
  title?: string;
  specialization?: string;
}

type AuthResult = { success: boolean; error?: string };

const DEMO_PASSWORD = 'Demo@1234';
const DEMO_CREDENTIALS: Record<UserRole, { email: string; password: string }> = {
  resident: { email: 'demo.resident@simplifix.app', password: DEMO_PASSWORD },
  facility_employee: { email: 'demo.employee@simplifix.app', password: DEMO_PASSWORD },
  maintenance_staff: { email: 'demo.staff@simplifix.app', password: DEMO_PASSWORD },
  facility_manager: { email: 'demo.manager@simplifix.app', password: DEMO_PASSWORD },
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please check your connection and try again.';
}

interface AuthState {
  currentUser: AppUser | null;
  token: string | null;
  users: AppUser[];
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  loginAsDemo: (role: UserRole) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateCurrentUser: (partial: Partial<AppUser>) => Promise<void>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  hydrateSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      token: null,
      users: [],
      isHydrated: false,

      login: async (email, password) => {
        try {
          const token = await loginUser(email, password);
          const apiUser = await getCurrentUser(token);
          await setToken(token);
          set({ token, currentUser: apiUserToAppUser(apiUser) });
          // Nearly every ticket/complaint screen across all roles resolves names via
          // the roster (mirrors the old mock setup, where every role saw everyone).
          await get().refreshUsers();
          return { success: true };
        } catch (err) {
          return { success: false, error: errorMessage(err) };
        }
      },

      loginAsDemo: async (role) => {
        const creds = DEMO_CREDENTIALS[role];
        return get().login(creds.email, creds.password);
      },

      register: async (input) => {
        try {
          await registerUser({
            name: input.name,
            email: input.email,
            phone: input.phone,
            role: input.role,
            password: input.password,
            building: input.building,
            unit_number: input.unitNumber,
            title: input.title,
            specialization: input.specialization,
          });
        } catch (err) {
          return { success: false, error: errorMessage(err) };
        }
        return get().login(input.email, input.password);
      },

      logout: async () => {
        await clearToken();
        set({ currentUser: null, token: null, users: [] });
      },

      updateCurrentUser: async (partial) => {
        const { currentUser, token } = get();
        if (!currentUser || !token) return;
        const apiUser = await updateUser(token, currentUser.userId, {
          name: partial.name,
          email: partial.email,
          phone: partial.phone,
          avatar_color: partial.avatarColor,
          avatar_uri: partial.avatarUri,
        });
        const updated = apiUserToAppUser(apiUser);
        set((state) => ({
          currentUser: updated,
          users: state.users.map((u) => (u.userId === updated.userId ? updated : u)),
        }));
      },

      approveUser: async (userId) => {
        const { token } = get();
        if (!token) return;
        const apiUser = await updateUser(token, userId, { account_status: 'active' });
        set((state) => ({
          users: state.users.map((u) => (u.userId === userId ? apiUserToAppUser(apiUser) : u)),
        }));
      },

      rejectUser: async (userId) => {
        const { token } = get();
        if (!token) return;
        const apiUser = await updateUser(token, userId, { account_status: 'rejected' });
        set((state) => ({
          users: state.users.map((u) => (u.userId === userId ? apiUserToAppUser(apiUser) : u)),
        }));
      },

      refreshUsers: async () => {
        const { token } = get();
        if (!token) return;
        const apiUsers = await listUsers(token);
        set({ users: apiUsers.map(apiUserToAppUser) });
      },

      hydrateSession: async () => {
        const token = await getToken();
        if (!token) {
          set({ isHydrated: true });
          return;
        }
        try {
          const apiUser = await getCurrentUser(token);
          set({ token, currentUser: apiUserToAppUser(apiUser) });
          await get().refreshUsers();
        } catch {
          await clearToken();
          set({ token: null, currentUser: null });
        } finally {
          set({ isHydrated: true });
        }
      },
    }),
    {
      name: 'simplifix-auth',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ currentUser: state.currentUser }),
    },
  ),
);
