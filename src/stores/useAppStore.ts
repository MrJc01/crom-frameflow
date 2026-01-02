import { create } from 'zustand';

export interface SceneElement {
  id: string;
  type: 'camera' | 'image' | 'text';
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
}

export const useAppStore = create<AppState>((set) => ({
  currentMode: 'edit',
  isStreamActive: false,
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
                  width: 480,
                  height: 270,
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
}))
