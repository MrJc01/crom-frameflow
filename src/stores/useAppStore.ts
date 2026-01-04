import { create } from 'zustand';

export interface SceneElement {
  id: string;
  type: 'camera' | 'image' | 'text' | 'video';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  // Style Props
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  // Video Props
  sourceType?: 'camera' | 'display';
  deviceId?: string;
  // Persistence
  assetId?: string;
}

export interface Card {
  id: string;
  type: 'scene'; // Unified type
  elements: SceneElement[];
  thumbnailUrl?: string; // Optional preview
  title?: string;
  width?: number; // Scene Resolution
  height?: number; // Scene Resolution
  backgroundColor?: string;
  layoutMode?: 'fixed' | 'infinite';
  viewportX?: number;
  viewportY?: number;
}

interface AppState {
  currentMode: 'edit' | 'present';
  isStreamActive: boolean
  cards: Card[];
  activeCardId: string | null;
  selectedElementId: string | null;
  
  setMode: (mode: 'edit' | 'present') => void
  toggleStream: (active: boolean) => void
  addCards: (newCards: Card[]) => void
  addCard: (newCard: Card) => void
  updateCardElements: (cardId: string, elements: SceneElement[]) => void
  updateCard: (cardId: string, updates: Partial<Card>) => void
  setActiveCard: (id: string | null) => void
  setSelectedElement: (id: string | null) => void
  loadProject: (projectData: { cards: Card[] }) => Promise<void>
  
  // Recording State
  isRecording: boolean;
  recordingStartTime: number | null;
  setIsRecording: (isRecording: boolean) => void;
  setRecordingStartTime: (time: number | null) => void;

  // Timeline State (NLE)
  timeline: {
    tracks: TimelineTrack[];
    currentTime: number; // ms
    duration: number; // ms
    isPlaying: boolean;
    zoom: number; // pixels per second
  };
  setTimelineTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  addTrack: (type: 'video' | 'audio') => void;
  addClip: (trackId: string, clip: TimelineClip) => void;

  // Optimization
  previewQuality: 'auto' | '1080p' | '720p' | '360p';
  setPreviewQuality: (quality: 'auto' | '1080p' | '720p' | '360p') => void;

  // Global Settings
  settings: {
      outputFps: 30 | 60;
      showDebugStats: boolean;
  };
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'audio';
  clips: TimelineClip[];
  isMuted?: boolean;
  isLocked?: boolean;
}

export interface TimelineClip {
  id: string;
  assetId: string;
  start: number; // ms on timeline
  duration: number; // ms duration
  offset: number; // ms offset into source
  name: string;
}

export const useAppStore = create<AppState>((set) => ({
  currentMode: 'edit',
  isStreamActive: false,
  isRecording: false,
  recordingStartTime: null,
  
  timeline: {
    tracks: [
        { id: 'track-1', type: 'video', clips: [] },
        { id: 'track-2', type: 'audio', clips: [] }
    ],
    currentTime: 0,
    duration: 30000, // Default 30s
    isPlaying: false,
    zoom: 100, // 100px per second default
  },
  
  previewQuality: 'auto',
  setPreviewQuality: (quality) => set({ previewQuality: quality }),

  settings: {
      outputFps: 30, // Default to 30 for stability
      showDebugStats: false
  },
  updateSettings: (newSettings) => set((state) => ({
      settings: { ...state.settings, ...newSettings }
  })),
  
  cards: [
      {
          id: 'default-scene',
          type: 'scene',
          title: 'Start Scene',
          width: 1920,
          height: 1080,
          backgroundColor: '#000000',
          layoutMode: 'fixed',
          elements: [
              {
                  id: 'default-camera',
                  type: 'camera',
                  content: 'camera-feed', 
                  x: 0,
                  y: 0,
                  width: 1920,
                  height: 1080,
                  rotation: 0,
                  zIndex: 0,
                  opacity: 1
              }
          ]
      }
  ],
  activeCardId: 'default-scene',
  selectedElementId: null,

  setMode: (mode) => set({ currentMode: mode }),
  toggleStream: (active) => set({ isStreamActive: active }),
  addCards: (newCards) => set((state) => ({ cards: [...state.cards, ...newCards] })),
  addCard: (newCard) => set((state) => ({ cards: [...state.cards, newCard] })),
  updateCardElements: (cardId, elements) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? { ...c, elements } : c)
  })),
  updateCard: (cardId, updates) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? { ...c, ...updates } : c)
  })),
  setActiveCard: (id) => set({ activeCardId: id, selectedElementId: null }),
  setSelectedElement: (id) => set({ selectedElementId: id }),
  
  loadProject: async (projectData) => {
      const { db } = await import('../db/FrameFlowDB'); // Dynamic import to avoid circular deps if any
      
      const newCards = [...projectData.cards];
      
      // Rehydrate Assets (Regenerate Blob URLs)
      for (const card of newCards) {
          for (const el of card.elements) {
              if (el.assetId) {
                  try {
                      const asset = await db.getAsset(el.assetId);
                      if (asset) {
                          el.content = URL.createObjectURL(asset.blob);
                      } else {
                          console.warn(`Asset ${el.assetId} not found in DB`);
                          // Keep existing content URL if possible, or sets error state? 
                          // Existing URL is likely dead blob:... so maybe set placeholder?
                      }
                  } catch (e) {
                      console.error("Failed to load asset", e);
                  }
              }
          }
      }
      
      set({ 
          cards: newCards,
          activeCardId: newCards.length > 0 ? newCards[0].id : null,
          selectedElementId: null
      });
  },

  setIsRecording: (isRecording) => set({ isRecording }),
  setRecordingStartTime: (time) => set({ recordingStartTime: time }),

  // Timeline Actions
  setTimelineTime: (time) => set(state => ({ timeline: { ...state.timeline, currentTime: time } })),
  setIsPlaying: (playing) => set(state => ({ timeline: { ...state.timeline, isPlaying: playing } })),
  
  addTrack: (type) => set(state => ({
      timeline: {
          ...state.timeline,
          tracks: [...state.timeline.tracks, { id: `track-${Date.now()}`, type, clips: [] }]
      }
  })),

  addClip: (trackId, clip) => set(state => ({
      timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.map(t => 
              t.id === trackId 
              ? { ...t, clips: [...t.clips, clip] }
              : t
          )
      }
  })),
}))
