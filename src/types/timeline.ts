import type { Keyframe } from './core';
import type { AudioPluginData } from './audio';

export interface TimelineClip {
  id: string;
  assetId: string;
  start: number; // ms on timeline
  duration: number; // ms duration
  offset: number; // ms offset into source
  name: string;
  chromaKey?: {
    enabled: boolean;
    color: [number, number, number];
    similarity: number;
    smoothness: number;
  };
  text3d?: {
    enabled: boolean;
    depth: number;
    color: string;
  };
  segmentation?: {
    enabled: boolean;
    model?: string;
  };
  lut?: {
    name: string;
    source?: string;
  };
  projection?: 'flat' | 'equirectangular';
  viewParams?: {
      yaw: number;
      pitch: number;
      fov: number;
  };
  animations?: Keyframe[];
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'audio';
  clips: TimelineClip[];
  isMuted?: boolean;
  isLocked?: boolean;
  volume?: number; 
  plugins?: AudioPluginData[];
}

export interface ProjectTemplate {
    id: string;
    name: string;
    thumbnail?: string;
    createdAt: number;
    timeline: {
        tracks: TimelineTrack[];
        duration: number;
        zoom: number;
    };
}
