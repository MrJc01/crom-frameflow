import { z } from 'zod';

// --- Keyframes (Core) ---
export const KeyframeSchema = z.object({
  time: z.number(),
  property: z.string(),
  value: z.number(),
  easing: z.string().optional(),
});

// --- Scene Elements (Cards) ---
export const SceneElementSchema = z.object({
  id: z.string(),
  type: z.enum(['camera', 'image', 'text', 'video']),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  zIndex: z.number(),
  
  // Optional Style Props
  opacity: z.number().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  
  // Video/Camera Props
  sourceType: z.enum(['camera', 'display']).optional(),
  deviceId: z.string().optional(),
  
  // Persistence/Effects
  assetId: z.string().optional(),
  chromaKey: z.object({
      enabled: z.boolean(),
      color: z.tuple([z.number(), z.number(), z.number()]),
      similarity: z.number(),
      smoothness: z.number(),
  }).optional(),
  text3d: z.object({
      enabled: z.boolean(),
      depth: z.number(),
      color: z.string(),
  }).optional(),
   segmentation: z.object({
      enabled: z.boolean(),
      model: z.string().optional(),
  }).optional(),
  lut: z.object({
    name: z.string(),
    source: z.string().optional(),
  }).optional(),
  animations: z.array(KeyframeSchema).optional(),
  projection: z.enum(['flat', 'equirectangular']).optional(),
  viewParams: z.object({
      yaw: z.number(),
      pitch: z.number(),
      fov: z.number(),
  }).optional(),
  filter: z.string().optional(),
});

// --- Card (Scene) ---
export const CardSchema = z.object({
  id: z.string(),
  type: z.literal('scene'),
  elements: z.array(SceneElementSchema),
  thumbnailUrl: z.string().optional(),
  title: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  backgroundColor: z.string().optional(),
  layoutMode: z.enum(['fixed', 'infinite']).optional(),
  viewportX: z.number().optional(),
  viewportY: z.number().optional(),
});

// --- Timeline Standard ---
export const TimelineClipSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  start: z.number(), // ms
  duration: z.number(), // ms
  offset: z.number(), // ms
  name: z.string(),
  
  // Timeline specific effects (subset of SceneElement or duplicated)
  chromaKey: z.object({
    enabled: z.boolean(),
    color: z.tuple([z.number(), z.number(), z.number()]),
    similarity: z.number(),
    smoothness: z.number(),
  }).optional(),
  text3d: z.object({
    enabled: z.boolean(),
    depth: z.number(),
    color: z.string(),
  }).optional(),
  segmentation: z.object({
    enabled: z.boolean(),
    model: z.string().optional(),
  }).optional(),
  lut: z.object({
    name: z.string(),
    source: z.string().optional(),
  }).optional(),
  projection: z.enum(['flat', 'equirectangular']).optional(),
  viewParams: z.object({
      yaw: z.number(),
      pitch: z.number(),
      fov: z.number(),
  }).optional(),
  animations: z.array(KeyframeSchema).optional(),
});

export const TimelineTrackSchema = z.object({
  id: z.string(),
  type: z.enum(['video', 'audio']),
  clips: z.array(TimelineClipSchema),
  isMuted: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  volume: z.number().optional(),
  plugins: z.array(z.any()).optional(), 
});

export const TimelineStateSchema = z.object({
    tracks: z.array(TimelineTrackSchema),
    duration: z.number(),
    zoom: z.number(),
});

// --- Project Import/Export ---
export const ProjectDataSchema = z.object({
    version: z.number().default(1),
    cards: z.array(CardSchema),
    // Optional timeline integration 
    timeline: TimelineStateSchema.optional(),
});

export const TemplateSchema = z.object({
    id: z.string(),
    name: z.string(),
    thumbnail: z.string().optional(),
    createdAt: z.number(),
    timeline: TimelineStateSchema
});
