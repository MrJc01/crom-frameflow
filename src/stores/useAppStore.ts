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
}

export interface Card {
  id: string;
  type: 'scene'; // Unified type
  elements: SceneElement[];
  thumbnailUrl?: string; // Optional preview
  title?: string;
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
  setActiveCard: (id: string | null) => void
  setSelectedElement: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentMode: 'edit',
  isStreamActive: false,
  cards: [],
  activeCardId: null,
  selectedElementId: null,

  setMode: (mode) => set({ currentMode: mode }),
  toggleStream: (active) => set({ isStreamActive: active }),
  addCards: (newCards) => set((state) => ({ cards: [...state.cards, ...newCards] })),
  addCard: (newCard) => set((state) => ({ cards: [...state.cards, newCard] })),
  updateCardElements: (cardId, elements) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? { ...c, elements } : c)
  })),
  setActiveCard: (id) => set({ activeCardId: id, selectedElementId: null }),
  setSelectedElement: (id) => set({ selectedElementId: id }),
}))
