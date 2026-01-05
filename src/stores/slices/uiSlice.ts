import { type StateCreator } from 'zustand';

export interface UiSlice {
  currentMode: 'edit' | 'present';
  isStreamActive: boolean;
  activeCardId: string | null;
  selectedElementId: string | null;
  selectedClipIds: string[]; // For timeline multi-selection
  previewQuality: 'auto' | '1080p' | '720p' | '360p';
  isRecording: boolean;
  recordingStartTime: number | null;
  showTemplateGallery: boolean; // New
  assets: { id: string; type: string; source: string; name: string }[];

  renderCache: {
    cachedRanges: { start: number; end: number }[];
    isRendering: boolean;
    progress: number;
    currentTime: number;
  };
  updateRenderCache: (updates: Partial<UiSlice['renderCache']>) => void;

  contextMenu: {
    isOpen: boolean;
    x: number;
    y: number;
    type: 'clip' | 'track' | 'canvas' | null;
    targetId: string | null;
  };
  setContextMenu: (menu: { isOpen: boolean; x: number; y: number; type: 'clip' | 'track' | 'canvas' | null; targetId: string | null }) => void;
  closeContextMenu: () => void;

  setMode: (mode: 'edit' | 'present') => void;
  toggleStream: (active: boolean) => void;
  setActiveCard: (id: string | null) => void;
  setSelectedElement: (id: string | null) => void;
  setSelectedClips: (ids: string[]) => void;
  setPreviewQuality: (quality: 'auto' | '1080p' | '720p' | '360p') => void;
  setIsRecording: (isRecording: boolean) => void;
  setRecordingStartTime: (time: number | null) => void;
  setShowTemplateGallery: (show: boolean) => void; // New
  addAsset: (asset: { id: string; type: string; source: string; name: string }) => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  currentMode: 'edit',
  isStreamActive: false,
  activeCardId: 'default-scene',
  selectedElementId: null,
  selectedClipIds: [],
  previewQuality: 'auto',
  isRecording: false,
  recordingStartTime: null,
  showTemplateGallery: false,
  assets: [],
  
  renderCache: {
    cachedRanges: [],
    isRendering: false,
    progress: 0,
    currentTime: 0
  },
  
  contextMenu: {
    isOpen: false,
    x: 0,
    y: 0,
    type: null,
    targetId: null
  },

  setContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: { isOpen: false, x: 0, y: 0, type: null, targetId: null } }),
  updateRenderCache: (updates) => set((state) => ({ renderCache: { ...state.renderCache, ...updates } })),

  setMode: (mode) => set({ currentMode: mode }),
  toggleStream: (active) => set({ isStreamActive: active }),
  setActiveCard: (id) => set({ activeCardId: id, selectedElementId: null }),
  setSelectedElement: (id) => set({ selectedElementId: id, selectedClipIds: [] }), // Clear clips when selecting element
  setSelectedClips: (ids) => set({ selectedClipIds: ids, selectedElementId: null }), // Clear element when selecting clips
  setPreviewQuality: (quality) => set({ previewQuality: quality }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setRecordingStartTime: (time) => set({ recordingStartTime: time }),
  setShowTemplateGallery: (show) => set({ showTemplateGallery: show }),
  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
});
