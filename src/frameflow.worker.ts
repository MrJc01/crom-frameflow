/* eslint-disable no-restricted-globals */
// frameflow.worker.ts
// The isolated rendering context

// Re-define types to avoid import issues in Worker context if naive bundler
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
    opacity?: number;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
    sourceType?: 'camera' | 'display';
    deviceId?: string;
    assetId?: string;
}
  
export interface EngineCard {
    id: string;
    type: 'scene';
    elements: SceneElement[];
    width?: number;
    height?: number;
    backgroundColor?: string;
    layoutMode?: 'fixed' | 'infinite';
    viewportX?: number;
    viewportY?: number;
}

export type RenderMode = 'COMPOSITION' | 'TIMELINE';

interface TimelineState {
    tracks: any[];
    currentTime: number;
    isPlaying: boolean;
}

// --- Worker State ---
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let renderMode: RenderMode = 'COMPOSITION';
let activeCard: EngineCard | null = null;

// Timeline
let timeline: TimelineState = { tracks: [], currentTime: 0, isPlaying: false };
let lastFrameTime = 0;
// let rafId: number | null = null; // Unused
let isRunning = false;

// Caches
const imageCache = new Map<string, ImageBitmap>();
const cameraFrameCache = new Map<string, ImageBitmap>(); // id -> bitmap
// For video files (not cameras), we can't easily use HTMLVideoElement in worker.
// We must rely on Main Thread to decode OR use WebCodecs VideoDecoder.
// For Phase 3 Simplicity: We will ask Main Thread to send us Video Frames too.
const videoFrameCache = new Map<string, ImageBitmap>(); // content (url) -> bitmap

// Configuration
// let previewQuality: 'auto' | '1080p' | '720p' | '360p' = 'auto'; // Unused


// --- Message Handlers ---
self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            canvas = payload.canvas;
            ctx = canvas!.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
            startLoop();
            break;
        case 'SET_MODE':
            renderMode = payload;
            break;
        case 'SET_CARD':
            activeCard = payload;
            // Preload images?
            // In worker, we fetch blobs.
            if (activeCard) {
                activeCard.elements.forEach(el => {
                   if (el.type === 'image' && !imageCache.has(el.content)) {
                       // Request blob or load
                       // If content is blob URL, it might not work in worker if created on main.
                       // Ideally we pass Blobs or Bitmaps.
                       // For now assume Main thread handles caching or passed clean URLs.
                       fetch(el.content)
                        .then(r => r.blob())
                        .then(b => createImageBitmap(b))
                        .then(bmp => imageCache.set(el.content, bmp))
                        .catch(err => console.warn("Failed to load image in worker", err));
                   }
                });
            }
            break;
        case 'UPDATE_TIMELINE':
            // Merge state
            timeline = { ...timeline, ...payload };
            break;
        case 'PLAY':
            timeline.isPlaying = true;
            lastFrameTime = performance.now();
            break;
        case 'PAUSE':
            timeline.isPlaying = false;
            break;
        case 'SEEK':
            timeline.currentTime = payload;
            timeline.isPlaying = false;
            break;
        
        // --- Frame Injection from Main Thread ---
        case 'CAMERA_FRAME':
            // payload: { id, bitmap }
            if (cameraFrameCache.has(payload.id)) {
                cameraFrameCache.get(payload.id)?.close(); // GC previous
            }
            cameraFrameCache.set(payload.id, payload.bitmap);
            break;
            
        case 'VIDEO_FRAME':
             // payload: { url, bitmap }
             if (videoFrameCache.has(payload.url)) {
                 videoFrameCache.get(payload.url)?.close();
             }
             videoFrameCache.set(payload.url, payload.bitmap);
             break;
             
        case 'RESIZE':
            if (canvas) {
                canvas.width = payload.width;
                canvas.height = payload.height;
            }
            break;
    }
};

function startLoop() {
    if (isRunning) return;
    isRunning = true;
    lastFrameTime = performance.now();
    loop();
}

function loop() {
    if (!isRunning) return;

    const now = performance.now();
    const delta = now - lastFrameTime; // Not used for logic if we rely on Main Thread Time?
    // Actually worker should drive time!
    
    // Logic: If playing, advance time
    if (renderMode === 'TIMELINE' && timeline.isPlaying) {
        // We advance time here, and send updates to UI?
        // OR UI sends time? 
        // Better: Worker is Source of Truth for Time.
        timeline.currentTime += delta;
        
        // Post time back to UI (throttled?)
        self.postMessage({ type: 'TIME_UPDATE', payload: timeline.currentTime });
    }
    
    lastFrameTime = now;
    
    render();
    
    requestAnimationFrame(loop);
}

function render() {
    if (!ctx || !canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    if (renderMode === 'TIMELINE') {
        renderTimeline(ctx, width, height);
    } else {
        renderComposition(ctx, width, height);
    }
}

function renderComposition(ctx: OffscreenCanvasRenderingContext2D, width: number, height: number) {
    if (!activeCard) return;

    // 1. Calculate Global Scene Scale to Fit Canvas (Letterbox) with Padding
    const sceneW = activeCard.width || 1920;
    const sceneH = activeCard.height || 1080;
    
    // Avoid division by zero
    if (sceneW === 0 || sceneH === 0) return;

    // Match EditorOverlay.tsx padding logic
    const padding = 40;
    const availW = Math.max(0, width - padding * 2);
    const availH = Math.max(0, height - padding * 2);

    const scale = Math.min(availW / sceneW, availH / sceneH);
    const offsetX = (width - sceneW * scale) / 2;
    const offsetY = (height - sceneH * scale) / 2;

    const sorted = [...activeCard.elements].sort((a,b) => a.zIndex - b.zIndex);
    
    // Apply Global Transform
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw Background (Black for letterbox areas is handled by clearRect outside, 
    // but the scene background itself?)
    // If scene has background color, draw it?
    if (activeCard.backgroundColor) {
        ctx.fillStyle = activeCard.backgroundColor;
        ctx.fillRect(0, 0, sceneW, sceneH);
    }
    
    for (const el of sorted) {
        ctx.save();
        
        // Element Transform (Relative to Scene Origin)
        const cx = el.x + el.width/2;
        const cy = el.y + el.height/2;
        
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation * Math.PI / 180);
        ctx.translate(-cx, -cy);
        
        if (el.type === 'image') {
            const bmp = imageCache.get(el.content);
            // Draw image filling the element box
            if (bmp) drawImageProp(ctx, bmp, el.x, el.y, el.width, el.height);
        } else if (el.type === 'camera') {
            const bmp = cameraFrameCache.get(el.id);
            if (bmp) {
                 drawImageProp(ctx, bmp, el.x, el.y, el.width, el.height);
            } else {
                ctx.fillStyle = '#333';
                ctx.fillRect(el.x, el.y, el.width, el.height);
                ctx.fillStyle = 'white';
                ctx.fillText("Loading Camera...", el.x + 10, el.y + 20);
            }
        } else if (el.type === 'video') {
            // Support AssetID or Content URL as key
            const bmp = videoFrameCache.get(el.content) || (el.assetId ? videoFrameCache.get(el.assetId) : undefined);
            
            if (bmp) {
                drawImageProp(ctx, bmp, el.x, el.y, el.width, el.height);
            } else {
                ctx.fillStyle = '#000';
                ctx.fillRect(el.x, el.y, el.width, el.height);
                // Optional: Draw play icon or something
            }
        }
        
        ctx.restore();
    }

    ctx.restore();
}

function renderTimeline(ctx: OffscreenCanvasRenderingContext2D, width: number, height: number) {
    // Render Clips for current time
    // Iterate tracks
     for (const track of timeline.tracks) {
           if (track.type !== 'video') continue; 

           for (const clip of track.clips) {
               // Check overlap
               const clipEnd = clip.start + clip.duration;
               if (timeline.currentTime >= clip.start && timeline.currentTime < clipEnd) {
                   // Draw
                   // Asset?
                   // Main thread handles Video Decoding and sends 'VIDEO_FRAME'
                   // But Main thread needs to know WHICH video to decode and seek to what time?
                   // This is the COMPLEX part.
                   
                   // Simplification for Phase 3 Proof of Concept:
                   // Just rely on what Main thread sent us?
                   // No, we need to request frames.
                   
                   // Actually, if we use Worker for Rendering, Main Thread should manage Video Elements (DOM)
                   // But Worker tells Main Thread "I need frame for Asset X at Time T".
                   
                   // For now, let's look at the simple "cameraFrameCache".
                   // If we are playing a video file, it's harder.
                   // Let's assume for now we only support 'camera' in pure Worker mode 
                   // or we use the 'videoFrameCache' that main thread pushes.
                   
                   const bmp = videoFrameCache.get(clip.assetId); // Or URL? ID is safer
                   if (bmp) {
                       drawImageProp(ctx, bmp, 0, 0, width, height); // Fullscreen for timeline?
                   }
               }
           }
      }
}

// Helper
function drawImageProp(ctx: OffscreenCanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number, offsetX = 0.5, offsetY = 0.5) {
     if (arguments.length === 2) {
          x = y = 0;
          w = ctx.canvas.width;
          h = ctx.canvas.height;
      }
      
      // ... (Same math as before) ...
       var iw = img.width,
          ih = img.height,
          r = Math.min(w / iw, h / ih),
          nw = iw * r,   // new prop. width
          nh = ih * r,   // new prop. height
          cx, cy, cw, ch, ar = 1;

      if (nw < w) ar = w / nw;                             
      if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
      nw *= ar;
      nh *= ar;

      cw = iw / (nw / w);
      ch = ih / (nh / h);

      cx = (iw - cw) * offsetX;
      cy = (ih - ch) * offsetY;

      if (cx < 0) cx = 0;
      if (cy < 0) cy = 0;
      if (cw > iw) cw = iw;
      if (ch > ih) ch = ih;

      ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}
