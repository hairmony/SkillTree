import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserSettings } from '@/types/app';

interface SettingsActions {
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: UserSettings = {
  displayName: 'Learner',
  animationsEnabled: true,
  notificationsEnabled: true,
  reducedMotion: false,
  autoAdvance: false,
  quizQuestionCount: 5,
  version: 1,
};

export const useSettingsStore = create<UserSettings & SettingsActions>()(
  persist(
    (set) => ({
      ...defaultSettings,
      updateSettings: (updates) => set((state) => ({ ...state, ...updates })),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'skilltree-settings-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
