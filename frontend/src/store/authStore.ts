import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USERS } from '@/data/seed';
import type { AppUser, UserRole } from '@/types';
import { generateId } from '@/utils/id';
import { isoNow } from '@/utils/date';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  unitNumber?: string;
  building?: string;
  apartmentId?: string;
  title?: string;
  specialization?: string;
}

interface AuthState {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (email: string) => { success: boolean; error?: string };
  loginAsDemo: (role: UserRole) => void;
  register: (input: RegisterInput) => { success: boolean; error?: string };
  logout: () => void;
  updateCurrentUser: (partial: Partial<AppUser>) => void;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: USERS,

      login: (email: string) => {
        const match = get().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!match) return { success: false, error: 'No account found with that email.' };
        set({ currentUser: match });
        return { success: true };
      },

      loginAsDemo: (role: UserRole) => {
        const match = get().users.find((u) => u.role === role);
        if (match) set({ currentUser: match });
      },

      register: (input: RegisterInput) => {
        const exists = get().users.some(
          (u) => u.email.toLowerCase() === input.email.trim().toLowerCase(),
        );
        if (exists) return { success: false, error: 'An account with that email already exists.' };

        const palette = ['#3452D9', '#7A3FC2', '#C2740F', '#1C7A5A', '#B62B4D', '#2E7BC2'];
        const base = {
          name: input.name,
          email: input.email,
          phone: input.phone,
          avatarColor: palette[Math.floor(Math.random() * palette.length)],
          createdAt: isoNow(),
        };

        let newUser: AppUser;
        switch (input.role) {
          case 'resident':
            newUser = {
              ...base,
              userId: generateId('user_res'),
              role: 'resident',
              accountStatus: 'active',
              apartmentId: input.apartmentId ?? generateId('apt'),
            };
            break;
          case 'facility_manager':
            newUser = {
              ...base,
              userId: generateId('user_mgr'),
              role: 'facility_manager',
              accountStatus: 'active',
              title: input.title?.trim() || 'Facility Manager',
            };
            break;
          case 'facility_employee':
            newUser = {
              ...base,
              userId: generateId('user_emp'),
              role: 'facility_employee',
              accountStatus: 'pending',
              title: input.title?.trim() || 'Facility Coordinator',
            };
            break;
          case 'maintenance_staff':
            newUser = {
              ...base,
              userId: generateId('user_wrk'),
              role: 'maintenance_staff',
              accountStatus: 'pending',
              specialization: input.specialization?.trim() || 'General Maintenance',
              activeJobs: 0,
              rating: 0,
            };
            break;
        }

        set((state) => ({ users: [...state.users, newUser], currentUser: newUser }));
        return { success: true };
      },

      logout: () => set({ currentUser: null }),

      updateCurrentUser: (partial) =>
        set((state) => {
          if (!state.currentUser) return state;
          const updated = { ...state.currentUser, ...partial } as AppUser;
          return {
            currentUser: updated,
            users: state.users.map((u) => (u.userId === updated.userId ? updated : u)),
          };
        }),

      approveUser: (userId: string) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.userId === userId ? { ...u, accountStatus: 'active' } : u,
          ),
        })),

      rejectUser: (userId: string) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.userId === userId ? { ...u, accountStatus: 'rejected' } : u,
          ),
        })),
    }),
    {
      name: 'simplifix-auth',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ currentUser: state.currentUser, users: state.users }),
      migrate: (persistedState) => {
        const state = persistedState as { currentUser: AppUser | null; users: AppUser[] };
        const backfill = (u: AppUser): AppUser =>
          u.accountStatus ? u : ({ ...u, accountStatus: 'active' } as AppUser);
        return {
          ...state,
          users: (state?.users ?? []).map(backfill),
          currentUser: state?.currentUser ? backfill(state.currentUser) : null,
        };
      },
    },
  ),
);
