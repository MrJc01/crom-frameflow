import { type StateCreator } from 'zustand';
import { type Card, type SceneElement, type ProjectTemplate } from '../../types';
import { type EasingType } from '../../utils/EasingFunctions';
import { templateService } from '../../services/TemplateService';
import type { AppState } from '../useAppStore';
import { ProjectDataSchema } from '../../schemas/project.schema';

export interface ProjectSlice {
  cards: Card[];
  addCards: (newCards: Card[]) => void;
  addCard: (newCard: Card) => void;
  updateCardElements: (cardId: string, elements: SceneElement[]) => void;
  updateCard: (cardId: string, updates: Partial<Card>) => void;
  removeCard: (cardId: string) => void;
  removeElement: (cardId: string, elementId: string) => void;
  updateElement: (cardId: string, elementId: string, updates: Partial<SceneElement>) => void;
  duplicateElement: (cardId: string, elementId: string) => void;
  loadProject: (projectData: { cards: Card[] }) => Promise<void>;
  saveAsTemplate: (name: string) => Promise<void>;
  loadTemplate: (templateId: string) => Promise<void>;
  listTemplates: () => Promise<ProjectTemplate[]>;
  addKeyframe: (cardId: string, elementId: string, property: string, time: number, value: number, easing?: EasingType) => void;
  removeKeyframe: (cardId: string, elementId: string, property: string, time: number) => void;
  setProject: (project: any) => void; // Placeholder
  importPresentation: (file: File) => Promise<void>; // Placeholder
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get) => ({
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
  addCards: (newCards) => set((state) => ({ cards: [...state.cards, ...newCards] })),
  addCard: (newCard) => set((state) => ({ cards: [...state.cards, newCard] })),
  updateCardElements: (cardId, elements) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? { ...c, elements } : c)
  })),
  updateCard: (cardId, updates) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? { ...c, ...updates } : c)
  })),
  removeCard: (cardId) => set((state) => ({
      cards: state.cards.filter(c => c.id !== cardId)
  })),
  removeElement: (cardId, elementId) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? { 
          ...c, 
          elements: c.elements.filter(e => e.id !== elementId) 
      } : c)
  })),
  updateElement: (cardId, elementId, updates) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? {
          ...c,
          elements: c.elements.map(e => e.id === elementId ? { ...e, ...updates } : e)
      } : c)
  })),
  
  duplicateElement: (cardId, elementId) => {
       const state = get();
       // Logic for duplication
       // ...
  },
  
  setProject: (project) => set({ cards: project.cards }),
  importPresentation: async (file) => {},

  loadProject: async (projectData) => {
      let db;
      try {
        const module = await import('../../db/FrameFlowDB');
        db = module.db;
      } catch (e) {
          console.error("Failed to import DB", e);
          return;
      }
      
      const validation = ProjectDataSchema.safeParse(projectData);
      
      if (!validation.success) {
          console.error("Project Schema Validation Failed:", validation.error.format());
          // Basic manual fallback/migration for older versions without 'version' field
          if (!('version' in projectData)) {
               console.warn("Legacy project detected. Attempting to migrate...");
               // In V0, structure was similar but strict validation might fail if new fields added.
               // For now, if Zod failed on legacy, it's likely incompatible.
               // TODO: distinct migration per version.
          }
          
          alert("Project file incompatible or corrupted.");
          return;
      }

      // Check Version
      if (validation.data.version > 1) {
           alert("This project was created with a newer version of the app. Please update FrameFlow.");
           return;
      }

      const newCards = [...validation.data.cards] as Card[];
      
      // Rehydrate Assets
      for (const card of newCards) {
          if (!card.elements) card.elements = [];
          for (const el of card.elements) {
              if (el.assetId) {
                  try {
                      const asset = await db.getAsset(el.assetId);
                      if (asset) {
                          if (asset.path) {
                              el.content = `frameflow://${encodeURIComponent(asset.path)}`;
                              if (asset.proxyPath) {
                                  el.proxyContent = `frameflow://${encodeURIComponent(asset.proxyPath)}`;
                              }
                          } else if (asset.blob) {
                              el.content = URL.createObjectURL(asset.blob);
                          }
                      }
                  } catch (e) {
                      console.error("Failed to load asset", e);
                  }
              }
          }
      }
      
      set((state) => {
          // We need to update multiple slices: UI and Project
          // Since state is AppState, we can just return partial ProjectSlice
          // But UI updates (setActiveCard) technically belong to UiSlice
          // zustand set allows merging.
          // However, Typescript might complain if we return properties not in ProjectSlice?
          // No, StateCreator returns Partial<AppState> usually?
          // Actually, StateCreator<AppState, [], [], ProjectSlice> implies we return ProjectSlice ONLY?
          // If we want to update UI, we should call those actions?
          // Or just update state manually if we have access.
          
          return { cards: newCards };
      });
      
      // Update UI separately if needed
      // Actually, standard pattern is to call actions if possible, or just set if slice boundaries are loose.
      // But let's stick to returning { cards } to satisfy ProjectSlice.
      // Ideally UI should react to cards change or we call `get().setActiveCard(...)`.
      const actions = get();
      if (actions.setActiveCard && newCards.length > 0) {
          actions.setActiveCard(newCards[0].id);
      }
  },

  saveAsTemplate: async (name) => {
      const state = get();
      const timeline = state.timeline;
      if (!timeline) return;

      const template: ProjectTemplate = {
          id: crypto.randomUUID(),
          name,
          createdAt: Date.now(),
          timeline: {
              tracks: timeline.tracks, 
              duration: timeline.duration,
              zoom: timeline.zoom
          }
      };
      await templateService.saveTemplate(template);
      console.log('Template saved:', name);
  },
  
  loadTemplate: async (templateId) => {
     const template = await templateService.loadTemplate(templateId);
     const state = get();
     if (template && state.setTimeline) {
         state.setTimeline({
             ...state.timeline,
             tracks: template.timeline.tracks,
             duration: template.timeline.duration,
             zoom: template.timeline.zoom ?? 100,
             currentTime: 0,
             isPlaying: false
         });
         console.log('Template loaded:', template.name);
     }
  },
  
  addKeyframe: (cardId, elementId, property, time, value, easing) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? {
          ...c,
          elements: c.elements.map(e => e.id === elementId ? {
              ...e,
              animations: [
                  ...(e.animations || []).filter(k => !(k.property === property && Math.abs(k.time - time) < 0.01)),
                  { property, time, value, easing }
              ].sort((a,b) => a.time - b.time)
          } : e)
      } : c)
  })),
  
  removeKeyframe: (cardId, elementId, property, time) => set((state) => ({
      cards: state.cards.map(c => c.id === cardId ? {
          ...c,
          elements: c.elements.map(e => e.id === elementId ? {
              ...e,
              animations: (e.animations || []).filter(k => !(k.property === property && Math.abs(k.time - time) < 0.01))
          } : e)
      } : c)
  })),
  
  listTemplates: async () => {
      return await templateService.listTemplates();
  }
});
