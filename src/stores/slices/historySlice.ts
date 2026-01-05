import { type StateCreator } from 'zustand';
import { commandManager } from '../../engine/commands/CommandManager';

export interface HistorySlice {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  // Internal sync
  syncHistoryState: () => void;
}

export const createHistorySlice: StateCreator<HistorySlice> = (set) => {
  // Bind manager updates to store
  commandManager.setNotifyCallback(() => {
      set({
          canUndo: commandManager.canUndo(),
          canRedo: commandManager.canRedo()
      });
  });

  return {
      canUndo: false,
      canRedo: false,
      undo: () => commandManager.undo(),
      redo: () => commandManager.redo(),
      syncHistoryState: () => set({
          canUndo: commandManager.canUndo(),
          canRedo: commandManager.canRedo()
      })
  };
};
