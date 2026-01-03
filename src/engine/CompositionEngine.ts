import { CameraManager } from './CameraManager';
import { useAppStore } from '../stores/useAppStore';

import { db } from '../db/FrameFlowDB';
import { ExportManager } from './ExportManager';
// Duplicate of Store types to avoid circular dependencies if strict, 
// or just re-define for Engine isolation.
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

export class CompositionEngine {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private rafId: number | null = null;
  private cameraManager: CameraManager;
  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  private fps: number = 0;
  
  // Card State
  private activeCard: EngineCard | null = null;
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private videoCache: Map<string, HTMLVideoElement> = new Map();
  private assetUrlCache: Map<string, string> = new Map();
  private mediaRecorder: MediaRecorder | null = null;
  // Timeline State
  private renderMode: 'COMPOSITION' | 'TIMELINE' = 'COMPOSITION';
  private timeline: { tracks: any[], currentTime: number, isPlaying: boolean } = { tracks: [], currentTime: 0, isPlaying: false };
  private onTimeUpdate?: (time: number) => void;
  public previewQuality: 'auto' | '1080p' | '720p' | '360p' = 'auto';

  // Optimization: LRU Cache
  private videoLastUsed = new Map<string, number>();
  private lastCleanupTime = 0;
  private readonly CLEANUP_INTERVAL = 5000; // Check every 5s
  private readonly MAX_IDLE_TIME = 10000;   // Remove if idle > 10s

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get canvas context');
    this.context = ctx;
    
    this.cameraManager = new CameraManager();
  }
  
  public setRenderMode(mode: 'COMPOSITION' | 'TIMELINE') {
      if (this.renderMode === mode) return;
      this.renderMode = mode;

      if (mode === 'TIMELINE') {
          // Suspend camera to save CPU
          this.cameraManager.pauseAll();
      } else {
          // Resume camera for recording/composition
          this.cameraManager.resumeAll();
      }
  }
  
  public setTimelineState(state: { tracks: any[], currentTime: number, isPlaying: boolean }) {
      // Sync state from Store
      // CRITICAL FIX: Do NOT overwrite currentTime if engine is playing, as Engine is the source of truth for time.
      // Also, handle tracks update safely.
      
      this.timeline.tracks = state.tracks;
      
      // If Engine thinks it is playing, ignore Playback state from Store to avoid race conditions?
      // Or accept it? Usually Store > Engine for user actions.
      // But for Time, Engine > Store.
      
      if (!this.timeline.isPlaying) {
          // Only accept external time set if we are paused (seeking)
          this.timeline.currentTime = state.currentTime;
      }
      
      // We accept isPlaying changes if they differ, but we rely on play()/pause() methods mostly.
      // If store says paused but we are playing...
      if (state.isPlaying !== this.timeline.isPlaying) {
         // console.warn("[Engine] State mismatch for isPlaying. Engine:", this.timeline.isPlaying, "Store:", state.isPlaying);
         // Let explicit play/pause methods handle this.
         // Or sync?
         // If we sync, we might stop playback inadvertently.
      }
  }

  public seek(time: number) {
      this.timeline.currentTime = time;
      this.timeline.isPlaying = false; // Seeking implies pausing usually
      console.log("[Engine] Seek to:", time);
  }

  public setTimeUpdateCallback(cb: (time: number) => void) {
      this.onTimeUpdate = cb;
  }

  public setPreviewQuality(quality: 'auto' | '1080p' | '720p' | '360p') {
      this.previewQuality = quality;
      // Force immediate resize if needed or let next frame handle it
      if (quality === '1080p') this.resize(1920, 1080); // Reset
  }

  public play() {
      console.log("[Engine] Play called. Current Mode:", this.renderMode);
      this.timeline.isPlaying = true;
      this.lastFrameTime = performance.now(); // Reset delta to avoid jumps
  }

  public pause() {
      console.log("[Engine] Pause called.");
      this.timeline.isPlaying = false;
  }

  private async render() {
    // console.log("[Engine] Render loop tick"); // Too noisy
    if (this.renderMode === 'TIMELINE') {
        await this.renderTimeline();
    } else {
        await this.renderComposition();
    }
  }

  private async renderTimeline() {
      const { width, height } = this.canvas;
      const ctx = this.context as CanvasRenderingContext2D;
      
      const now = performance.now();
      const settings = useAppStore.getState().settings;
      const targetFps = settings.outputFps || 30;
      const interval = 1000 / targetFps;
      const delta = now - this.lastFrameTime;

      // FPS Lock: Skip if not enough time passed
      if (delta < interval) return;

      // Adjust lastFrameTime to maintain cadence (subtracting variance)
      this.lastFrameTime = now - (delta % interval);

      // 1. Advance Time if Playing
      if (this.timeline.isPlaying) {
          // Advance by the simplified interval or actual delta? 
          // Using 'interval' forces smooth steps, 'delta' tracks wall clock.
          // Let's use interval to match the rendered frame step exactly for smoothness.
          // However, if we dropped a lot of frames, we should catch up.
          // For simple playback:
          this.timeline.currentTime += delta; 
          
          if (this.onTimeUpdate) {
              this.onTimeUpdate(this.timeline.currentTime);
          }
      }
      
      // ... rest of renderTimeline

      // 2. Clear & Resize
      // Resolution Scaling
      let scale = 1;
      if (this.previewQuality === '360p') scale = 0.25; // 1080p -> 270p (rough)
      else if (this.previewQuality === '720p') scale = 0.67; 
      else if (this.previewQuality === '1080p') scale = 1;
      else { 
          // Auto: Check FPS
          if (this.fps < 25) scale = 0.5;
          else scale = 1;
      }

      // We only resize the internal canvas buffering context if we had one.
      // But here we are drawing to THIS.CANVAS.
      // Changing this.canvas.width/height CLEARS the canvas automatically.
      
      const targetW = Math.floor(1920 * scale);
      const targetH = Math.floor(1080 * scale);
      
      // Only resize if significantly different to avoid thrashing
      if (Math.abs(width - targetW) > 10 && this.renderMode === 'TIMELINE') {
           this.resize(targetW, targetH);
           // Update local vars after resize
           return; // Return frame to let resize take effect next tick (avoid flicker)
      }

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);

      // 3. Render Clips
      // Iterate tracks bottom-up
      for (const track of this.timeline.tracks) {
          if (track.type !== 'video') continue; // Skip audio for canvas render

          for (const clip of track.clips) {
              // Check overlap
              const clipEnd = clip.start + clip.duration;
              if (this.timeline.currentTime >= clip.start && this.timeline.currentTime < clipEnd) {
                  // Visible!
                  let assetUrl = this.assetUrlCache.get(clip.assetId);

                  if (!assetUrl) {
                      // Cache Miss: Trigger load but don't block render
                      this.loadAsset(clip.assetId);
                      continue; // Skip this frame until loaded
                  }

                  // Cache Hit: Draw immediately
                  const seekTime = (this.timeline.currentTime - clip.start + clip.offset) / 1000;
                  await this.drawVideoFrame(ctx, assetUrl, seekTime, width, height);
              }
          }
      }
  }

  // Fire-and-forget loader (debouncing could be added if needed)
  private loadingAssets = new Set<string>();
  
  private async loadAsset(assetId: string) {
      if (this.loadingAssets.has(assetId)) return;
      this.loadingAssets.add(assetId);
      
      try {
          const asset = await db.getAsset(assetId);
          if (asset && asset.blob) {
              const url = URL.createObjectURL(asset.blob);
              this.assetUrlCache.set(assetId, url);
          }
      } catch (e) {
          console.warn("Failed to load asset", assetId, e);
      } finally {
          this.loadingAssets.delete(assetId);
      }
  }

  // Old resolveAsset removed.
  
  private async drawVideoFrame(ctx: CanvasRenderingContext2D, url: string, time: number, w: number, h: number) {
       // Track usage
       this.videoLastUsed.set(url, performance.now());

       let vid = this.videoCache.get(url);
       if (!vid) {
           vid = document.createElement('video');
           vid.src = url;
           vid.muted = true;
//           vid.playsInline = true;
           (vid as any).playsInline = true; // TS fix
           this.videoCache.set(url, vid);
       }
       
       // Hybrid Playback/Seek Logic
       if (this.timeline.isPlaying) {
           // If we are "playing", try to let the video play naturally to ensure smooth stream
           if (vid.paused) vid.play().catch(() => {});
           
           // Sync check: If drift is too large, snap it.
           const drift = vid.currentTime - time;
           if (Math.abs(drift) > 0.2) {
               vid.currentTime = time;
           }
       } else {
           // Paused: Precise seeking
           vid.pause();
           if (Math.abs(vid.currentTime - time) > 0.05) {
               vid.currentTime = time;
           }
       }
       
       // Draw if we have ANY data (readyState >= 1: HAVE_METADATA is risky, usually 2: HAVE_CURRENT_DATA)
       // But during seek, it might drop. We try to draw to prevent black frames.
       if (vid.readyState >= 2 || (vid.readyState >= 1 && vid.currentTime > 0)) {
           this.drawImageProp(ctx, vid, 0, 0, w, h);
       }
  }

  private async renderComposition() {
    const { width, height } = this.canvas;
    const ctx = this.context as CanvasRenderingContext2D;

    // 1. Clear
    ctx.clearRect(0, 0, width, height);

    // 2. Render Scene
    if (this.activeCard) {
        const isInfinite = this.activeCard.layoutMode === 'infinite';
        
        // --- Transform Logic ---
        let sceneScale = 1;
        let sceneTx = 0;
        let sceneTy = 0;

        if (!isInfinite) {
             const sceneW = this.activeCard.width || 1920;
             const sceneH = this.activeCard.height || 1080;
             const padding = 40;
             const availW = width - padding * 2;
             const availH = height - padding * 2;
             
             if (availW > 0 && availH > 0) {
                sceneScale = Math.min(availW / sceneW, availH / sceneH);
                sceneTx = (width - sceneW * sceneScale) / 2;
                sceneTy = (height - sceneH * sceneScale) / 2;
             }
             
             // Draw Void
             ctx.save();
             ctx.fillStyle = '#111';
             ctx.fillRect(0, 0, width, height);
             ctx.restore();
        } else {
             // Infinite: Just viewport offset
             sceneTx = -(this.activeCard.viewportX || 0);
             sceneTy = -(this.activeCard.viewportY || 0);
             
             // Draw Infinite Guide
             const outW = this.activeCard.width || 1920;
             const outH = this.activeCard.height || 1080;
             
             // Draw Dark Overlay outside the active area
             ctx.save();
             ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
             
             // Top
             if (height > outH) ctx.fillRect(0, outH, width, height - outH);
             // Right
             if (width > outW) ctx.fillRect(outW, 0, width - outW, height);
             
             // Draw Guide Border
             ctx.strokeStyle = '#FF0000';
             ctx.lineWidth = 2;
             ctx.setLineDash([10, 5]);
             ctx.strokeRect(0, 0, outW, outH);
             
             // Label
             ctx.fillStyle = '#FF0000';
             ctx.font = '12px sans-serif';
             ctx.fillText("LIVE OUTPUT AREA", 10, 20);
             
             ctx.restore();
        }

        ctx.save(); // Start Scene Transform Block
        ctx.translate(sceneTx, sceneTy);
        ctx.scale(sceneScale, sceneScale);

        if (!isInfinite) {
             // Draw Card Background & Clip within local space
             const sceneW = this.activeCard.width || 1920;
             const sceneH = this.activeCard.height || 1080;
             
             ctx.beginPath();
             ctx.rect(0, 0, sceneW, sceneH);
             ctx.clip();
             
             ctx.fillStyle = this.activeCard.backgroundColor || '#000';
             ctx.fillRect(0, 0, sceneW, sceneH);
        }

        // Sort elements
        const sortedElements = [...this.activeCard.elements].sort((a, b) => Number(a.zIndex) - Number(b.zIndex));

        for (const el of sortedElements) {
            ctx.save();
            
            // Elements are positioned in Scene Space.
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;

            ctx.translate(cx, cy);
            ctx.rotate(el.rotation * Math.PI / 180);
            ctx.translate(-cx, -cy);
            
            const drawX = el.x;
            const drawY = el.y;

            if (el.type === 'camera') {
                const video = this.cameraManager.getVideoElement(el.id);
                // Check readyState
                if (video && video.readyState >= 2) { 
                    this.drawImageProp(ctx, video, drawX, drawY, el.width, el.height);
                } else {
                    ctx.fillStyle = '#222';
                    ctx.fillRect(drawX, drawY, el.width, el.height);
                    ctx.fillStyle = '#555';
                    ctx.font = '12px sans-serif';
                    ctx.fillText(el.sourceType === 'display' ? "Select Screen" : "Loading Camera...", drawX + 10, drawY + 20);
                }
            } else if (el.type === 'image') {
                const img = this.imageCache.get(el.content);
                if (img && img.complete) {
                    this.drawImageProp(ctx, img, drawX, drawY, el.width, el.height);
                } else {
                    ctx.fillStyle = '#333';
                    ctx.fillRect(drawX, drawY, el.width, el.height);
                    ctx.fillStyle = '#fff';
                    ctx.fillText("Loading...", drawX + 10, drawY + 20);
                }
            } else if (el.type === 'video') {
                const vid = this.videoCache.get(el.content);
                if (vid && vid.readyState >= 2) {
                    this.drawImageProp(ctx, vid, drawX, drawY, el.width, el.height);
                } else {
                     ctx.fillStyle = '#1a1a1a';
                     ctx.fillRect(drawX, drawY, el.width, el.height);
                     ctx.fillStyle = '#fff';
                     ctx.fillText("Loading Video...", drawX + 10, drawY + 20);
                }
            } else if (el.type === 'text') {
                const fontSize = el.fontSize || 30;
                const fontFamily = el.fontFamily || 'Inter';
                const color = el.color || 'white';
                const opacity = el.opacity ?? 1;

                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.font = `${fontSize}px ${fontFamily}`;
                ctx.fillStyle = color;
                ctx.textBaseline = 'top';
                ctx.fillText(el.content, drawX, drawY);
                ctx.restore();
            }

            ctx.restore(); // End Item Transform
        }
        
        ctx.restore(); // End Scene Transform (Clip/Scale/Translate)
    }

    // 4. Draw FPS
    const now = performance.now();
    this.fps = Math.round(1000 / (now - this.lastFrameTime));
    this.lastFrameTime = now;

    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`FPS: ${this.fps}`, 20, 40);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    // Check if we have an active card with camera elements and start them?
    // Usually setCard is called before start or right after.
    
    this.isRunning = true;
    
    // Listen for UI requests to start screen share
    window.addEventListener('frameflow:start-screen-share', (e: any) => {
        const { elementId } = e.detail;
        this.cameraManager.startScreenShare(elementId)
            .catch(err => console.error("Failed to start screen share", err));
    });

    this.loop();
  }

  setCard(card: EngineCard | null) {
      if (this.activeCard === card) return; // No change
      
      this.activeCard = card;
      // Preload images & Initialize Cameras
      if (card) {
          card.elements.forEach(el => {
              if (el.type === 'image' && !this.imageCache.has(el.content)) {
                  const img = new Image();
                  img.src = el.content;
                  img.onload = () => { /* loaded */ };
                  this.imageCache.set(el.content, img);
              }

              if (el.type === 'video' && !this.videoCache.has(el.content)) {
                  const vid = document.createElement('video');
                  vid.src = el.content;
                  vid.muted = true;
                  vid.loop = true;
                  vid.playsInline = true;
                  vid.autoplay = true;
                  vid.play().catch(e => console.error("Auto-play failed", e));
                  this.videoCache.set(el.content, vid);
              }
              
              if (el.type === 'camera') {
                   // Check if source needs update
                   const currentSource = this.cameraManager.getSource(el.id);
                   const targetType = el.sourceType || 'camera';
                   const targetDevice = el.deviceId;

                   const needsUpdate = !currentSource || 
                                       currentSource.type !== targetType || 
                                       (targetType === 'camera' && currentSource.deviceId !== targetDevice);

                   if (needsUpdate) {
                       if (targetType === 'camera') {
                            this.cameraManager.startCamera(el.id, targetDevice)
                                .catch(err => console.error("Failed to update camera source", err));
                       } else if (targetType === 'display' && !currentSource) {
                           // For display, we usually wait for user interaction, but if we switched type
                           // we might want to kill the old camera.
                           // Actually, we can't auto-start display. Implementation:
                           // If switching to display, stop camera. UI must trigger startScreenShare.
                           if (currentSource) this.cameraManager.stop(el.id);
                       }
                   }
              }
          });
      }
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.cameraManager.stopAll();
    
    // Memory Cleanup: Revoke all object URLs
    this.assetUrlCache.forEach((url) => {
        URL.revokeObjectURL(url);
    });
    this.assetUrlCache.clear();
    
    // Clear video cache (pause them)
    this.videoCache.forEach((vid) => {
        vid.pause();
        vid.src = "";
        vid.load();
    });
    this.videoCache.clear();

    if (this.context instanceof CanvasRenderingContext2D || this.context instanceof OffscreenCanvasRenderingContext2D) {
       this.context.fillStyle = '#000';
       this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // --- Recording API ---
  // mediaRecorder is defined at the top
  private recordedChunks: Blob[] = [];

  async startRecording(): Promise<void> {
      try {
          const stream = this.canvas.captureStream(60);
          this.mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'video/webm;codecs=vp9'
          });

          this.recordedChunks = [];
          this.mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  this.recordedChunks.push(event.data);
              }
          };

          this.mediaRecorder.start();
          console.log("Recording started");
      } catch (err) {
          console.error("Failed to start recording:", err);
          throw err;
      }
  }

  async stopRecording(): Promise<Blob> {
      return new Promise((resolve, reject) => {
          if (!this.mediaRecorder) {
              reject(new Error("No active recorder"));
              return;
          }

          this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.recordedChunks, {
                  type: 'video/webm'
              });
              this.recordedChunks = [];
              this.mediaRecorder = null;
              resolve(blob);
          };

          this.mediaRecorder.stop();
          console.log("Recording stopped");
      });
  }

  // --- Stream Access for Preview Monitor ---
  getStream(): MediaStream {
      return this.canvas.captureStream(60);
  }

  private garbageCollectResources() {
      const now = performance.now();
      if (now - this.lastCleanupTime < this.CLEANUP_INTERVAL) return;
      this.lastCleanupTime = now;

      for (const [url, lastTime] of this.videoLastUsed.entries()) {
          // If unused for MAX_IDLE_TIME, remove it
          if (now - lastTime > this.MAX_IDLE_TIME) {
              const vid = this.videoCache.get(url);
              if (vid) {
                  console.debug("[Engine] GC: Removing idle video element", url);
                  vid.pause();
                  vid.src = "";
                  vid.load();
                  this.videoCache.delete(url);
              }
              this.videoLastUsed.delete(url);
          }
      }
  }

  private loop = async () => {
    if (!this.isRunning) return;
    
    // Performance: Frame Skipping
    // const now = performance.now();
    // const delta = now - this.lastFrameTime;

    this.garbageCollectResources();

    await this.render();
    
    this.rafId = requestAnimationFrame(this.loop);
  };

  /**
   * Export Process (WebCodecs)
   */
  async exportVideo(onProgress?: (percent: number) => void): Promise<void> {
      console.log("Starting Export...");
      const wasRunning = this.isRunning;
      this.stop(); // Stop loop/camera
      
      const width = 1920;
      const height = 1080;
      
      const settings = useAppStore.getState().settings;
      const fps = settings.outputFps || 30;
      const duration = this.timeline.tracks.reduce((max, track) => {
          const trackEnd = track.clips.reduce((end: number, clip: any) => Math.max(end, clip.start + clip.duration), 0);
          return Math.max(max, trackEnd);
      }, 0); // ms

      if (duration === 0) {
          alert("Timeline is empty!");
          if (wasRunning) this.start();
          return;
      }
      
      // Force 1080p for export
      this.canvas.width = width;
      this.canvas.height = height;
      this.previewQuality = '1080p'; // Force full quality

      const exportManager = new ExportManager(width, height, fps);
      await exportManager.initialize();

      const totalFrames = Math.ceil((duration / 1000) * fps);
      const frameDuration = 1000 / fps; // ms

      for (let i = 0; i < totalFrames; i++) {
           const time = i * frameDuration;
           this.timeline.currentTime = time;
           
           // Force render at this time
           // Note: renderTimeline uses this.timeline.currentTime
           await this.renderTimeline();
           
           // Encode
           await exportManager.encodeFrame(this.canvas, time);
           
           if (onProgress) onProgress(Math.floor((i / totalFrames) * 100));
      }

      await exportManager.finish();
      console.log("Export Finished!");
      
      if (wasRunning) this.start();
  }

  // Helper to draw image cover (like CSS object-fit: cover)
  private drawImageProp(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, offsetX: number = 0.5, offsetY: number = 0.5) {
      if (arguments.length === 2) {
          x = y = 0;
          w = ctx.canvas.width;
          h = ctx.canvas.height;
      }

      // default offset is center
      offsetX = typeof offsetX === "number" ? offsetX : 0.5;
      offsetY = typeof offsetY === "number" ? offsetY : 0.5;

      // keep bounds [0.0, 1.0]
      if (offsetX < 0) offsetX = 0;
      if (offsetX > 1) offsetX = 1;
      if (offsetY < 0) offsetY = 0;
      if (offsetY > 1) offsetY = 1;

      var iw = (img as HTMLVideoElement).videoWidth || (img as HTMLCanvasElement).width || (img as any).width,
          ih = (img as HTMLVideoElement).videoHeight || (img as HTMLCanvasElement).height || (img as any).height,
          r = Math.min(w / iw, h / ih),
          nw = iw * r,   // new prop. width
          nh = ih * r,   // new prop. height
          cx, cy, cw, ch, ar = 1;

      // decide which gap to fill    
      if (nw < w) ar = w / nw;                             
      if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
      nw *= ar;
      nh *= ar;

      // calc source rectangle
      cw = iw / (nw / w);
      ch = ih / (nh / h);

      cx = (iw - cw) * offsetX;
      cy = (ih - ch) * offsetY;

      // make sure source rectangle is valid
      if (cx < 0) cx = 0;
      if (cy < 0) cy = 0;
      if (cw > iw) cw = iw;
      if (ch > ih) ch = ih;

      // fill image in dest. rectangle
      ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
  }

  resize(width: number, height: number) {
      this.canvas.width = width;
      this.canvas.height = height;
  }
}
