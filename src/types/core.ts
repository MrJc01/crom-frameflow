import { type EasingType } from '../utils/EasingFunctions';

export interface Keyframe {
  time: number; // relative to clip/element Start
  property: string;
  value: number;
  easing?: EasingType;
}

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
  proxyContent?: string; // Cache-busted URL for proxy
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
    // Removed duplicate enabled property
  };
  segmentation?: {
    enabled: boolean;
    model?: string;
  };
  lut?: {
    name: string;
    source?: string;
  };
  animations?: Keyframe[];
  projection?: 'flat' | 'equirectangular';
  viewParams?: {
      yaw: number;
      pitch: number;
      fov: number;
  };
  filter?: string; // CSS filter string for effects
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

export interface AppSettings {
    outputFps: 30 | 60;
    previewFps: number; // 30, 60, or 120 (max)
    showDebugStats: boolean;
}
