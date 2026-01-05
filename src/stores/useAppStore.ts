import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createTimelineSlice, type TimelineSlice } from './slices/timelineSlice';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createHistorySlice, type HistorySlice } from './slices/historySlice';

import { APP_CONFIG } from '../config/constants';
// Re-export types for backward compatibility
export * from '../types';

export type AppState = TimelineSlice & ProjectSlice & UiSlice & SettingsSlice & HistorySlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createTimelineSlice(...a),
      ...createProjectSlice(...a),
      ...createUiSlice(...a),
      ...createSettingsSlice(...a),
      ...createHistorySlice(...a),
    }),
    {
      name: APP_CONFIG.STORAGE.KEY,
      // Only persist project data and settings
      partialize: (state) => ({
        cards: state.cards,
        settings: state.settings,
        // We do NOT persist timeline (playing state) or UI (active selection)
        // or history (undo stack)? History could be persisted.
      }),
    }
  )
);

