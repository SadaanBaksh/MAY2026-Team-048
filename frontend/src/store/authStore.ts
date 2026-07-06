import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USERS } from '@/data/seed';
import type { AppUser, Resident, UserRole } from '@/types';
import { generateId } from '@/utils/id';
import { isoNow } from '@/utils/date';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  unitNumber: string;
  building: string;
  apartmentId?: string;
}

interface AuthState {
  currentUser: AppUser | null;
  users: AppUser[];
  login: (email: string) => { success: boolean; error?: string };
  loginAsDemo: (role: UserRole) => void;
  register: (input: RegisterInput) => { success: boolean; error?: string };
  logout: () => void;
  updateCurrentUser: (partial: Partial<AppUser>) => void;
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
        const exists = get().users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase());
        if (exists) return { success: false, error: 'An account with that email already exists.' };

        const palette = ['#3452D9', '#7A3FC2', '#C2740F', '#1C7A5A', '#B62B4D', '#2E7BC2'];
        const newResident: Resident = {
          userId: generateId('user_res'),
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: 'resident',
          avatarColor: palette[Math.floor(Math.random() * palette.length)],
          createdAt: isoNow(),
          apartmentId: input.apartmentId ?? generateId('apt'),
        };

        set((state) => ({ users: [...state.users, newResident], currentUser: newResident }));
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
    }),
    {
      name: 'simplifix-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ currentUser: state.currentUser, users: state.users }),
    }
  )
);
