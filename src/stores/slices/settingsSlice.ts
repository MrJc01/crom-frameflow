import { type StateCreator } from 'zustand';
import { type AppSettings } from '../../types';

export interface SettingsSlice {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  settings: {
      outputFps: 30,
      previewFps: 30, // Default to 30 for battery saving
      showDebugStats: false
  },
  updateSettings: (newSettings) => set((state) => ({
      settings: { ...state.settings, ...newSettings }
  })),
});
