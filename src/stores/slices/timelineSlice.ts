import { type StateCreator } from 'zustand';
import { type TimelineClip, type TimelineTrack } from '../../types';

export interface TimelineSlice {
  timeline: {
    tracks: TimelineTrack[];
    currentTime: number; // ms
    duration: number; // ms
    isPlaying: boolean;
    zoom: number; // pixels per second
  };
  setTimelineTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  play: () => void;
  pause: () => void;
  addTrack: (type: 'video' | 'audio') => void;
  addClip: (trackId: string, clip: TimelineClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  duplicateClip: (clipId: string) => void;
  // Advanced
  setTimeline: (timeline: TimelineSlice['timeline']) => void; 
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
}

export const createTimelineSlice: StateCreator<TimelineSlice> = (set) => ({
  timeline: {
    tracks: [
        { id: 'track-1', type: 'video', clips: [] },
        { id: 'track-2', type: 'audio', clips: [] }
    ],
    currentTime: 0,
    duration: 30000,
    isPlaying: false,
    zoom: 100,
  },
  setTimelineTime: (time) => set((state) => ({ timeline: { ...state.timeline, currentTime: time } })),
  setIsPlaying: (playing) => set((state) => ({ timeline: { ...state.timeline, isPlaying: playing } })),
  play: () => set((state) => ({ timeline: { ...state.timeline, isPlaying: true } })),
  pause: () => set((state) => ({ timeline: { ...state.timeline, isPlaying: false } })),
  addTrack: (type) => set((state) => ({
      timeline: {
          ...state.timeline,
          tracks: [...state.timeline.tracks, { id: `track-${Date.now()}`, type, clips: [] }]
      }
  })),
  addClip: (trackId, clip) => set((state) => ({
      timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.map(t => 
              t.id === trackId 
              ? { ...t, clips: [...t.clips, clip] }
              : t
          )
      }
  })),
  removeClip: (clipId) => set((state) => ({
      timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.map(t => ({
              ...t,
              clips: t.clips.filter(c => c.id !== clipId)
          }))
      }
  })),
  updateClip: (clipId, updates) => set((state) => ({
      timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.map(t => ({
              ...t,
              clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
          }))
      }
  })),
  duplicateClip: (clipId) => set((state) => {
      let clipToDuplicate: TimelineClip | null = null; // Fix 1: Type annotation fix if needed, but inference is usually okay
      let targetTrackId: string | null = null;

      // Find clip and track
      for (const track of state.timeline.tracks) {
          const found = track.clips.find(c => c.id === clipId);
          if (found) {
              clipToDuplicate = found;
              targetTrackId = track.id;
              break;
          }
      }

      if (!clipToDuplicate || !targetTrackId) return {};

      // Create copy
      const newClip: TimelineClip = {
          ...clipToDuplicate,
          id: crypto.randomUUID(),
          start: clipToDuplicate.start + clipToDuplicate.duration, // Append after
      };

      return {
          timeline: {
              ...state.timeline,
              tracks: state.timeline.tracks.map(t => 
                  t.id === targetTrackId
                  ? { ...t, clips: [...t.clips, newClip] }
                  : t
              )
          }
      };
  }),
  setTimeline: (timeline) => set(() => ({ timeline })),
  updateTrack: (trackId, updates) => set((state) => ({
      timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.map(t => 
              t.id === trackId ? { ...t, ...updates } : t
          )
      }
  })),
});
