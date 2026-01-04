import { CameraManager } from './CameraManager';
// import { useAppStore } from '../stores/useAppStore'; // Store access might be needed for events
import { db } from '../db/FrameFlowDB'; 

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

// ... (EngineCard interface remains)



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
  private worker: Worker;
  private canvas: HTMLCanvasElement;
  private cameraManager: CameraManager;
  private activeCard: EngineCard | null = null;
  private isRunning: boolean = false;
  private videoContainer: HTMLDivElement;
  
  private videoElements = new Map<string, HTMLVideoElement>();
  private timelineState = { tracks: [] as any[], currentTime: 0, isPlaying: false };

  // Helper State
  private onTimeUpdate?: (time: number) => void;
  private rafId: number | null = null;
  private lastRenderMode: 'COMPOSITION' | 'TIMELINE' = 'COMPOSITION';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.cameraManager = new CameraManager();

    // Hidden Video Jail (Off-screen but "visible" to forcing decoding)
    this.videoContainer = document.createElement('div');
    this.videoContainer.style.cssText = "position: fixed; top: -9999px; left: -9999px; width: 16px; height: 16px; opacity: 0; pointer-events: none; z-index: -1;";
    document.body.appendChild(this.videoContainer);

    // 1. Initialize Worker (Standard)
    this.worker = new Worker(new URL('../frameflow.worker.ts', import.meta.url), { type: 'module' });

    // 2. Transfer Canvas
    const offscreen = this.canvas.transferControlToOffscreen();
    this.worker.postMessage({ type: 'INIT', payload: { canvas: offscreen } }, [offscreen]);

    // 3. Listen
    this.worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'TIME_UPDATE') {
            this.timelineState.currentTime = payload; // Critical: Sync internal state for video pump
            if (this.onTimeUpdate) this.onTimeUpdate(payload);
        }
    };
  }

  public setRenderMode(mode: 'COMPOSITION' | 'TIMELINE') {
      if (this.lastRenderMode === mode) return;
      this.lastRenderMode = mode;
      
      this.worker.postMessage({ type: 'SET_MODE', payload: mode });
      
      if (mode === 'TIMELINE') {
          this.cameraManager.pauseAll();
      } else {
          this.cameraManager.resumeAll();
      }
  }

  public setTimelineState(state: { tracks: any[], currentTime: number, isPlaying: boolean }) {
      this.timelineState = state;
      // Proxy to worker
      this.worker.postMessage({ type: 'UPDATE_TIMELINE', payload: state });
      
      if (state.isPlaying) this.play();
      else this.pause();
  }
  
  public setCard(card: EngineCard | null) {
      this.activeCard = card;
      this.worker.postMessage({ type: 'SET_CARD', payload: card });
      
      // Handle Camera Logic ON MAIN THREAD (as before)
      if (card) {
          card.elements.forEach(el => {
               if (el.type === 'camera') {
                   // ... (Same Camera Setup Logic as before) ...
                   const currentSource = this.cameraManager.getSource(el.id);
                   const targetType = el.sourceType || 'camera';
                   const targetDevice = el.deviceId;

                   const needsUpdate = !currentSource || 
                                       currentSource.type !== targetType || 
                                       (targetType === 'camera' && currentSource.deviceId !== targetDevice);

                   if (needsUpdate) {
                       if (targetType === 'camera') {
                            this.cameraManager.startCamera(el.id, targetDevice).catch(console.error);
                       } else if (targetType === 'display' && !currentSource) {
                           if (currentSource) this.cameraManager.stop(el.id);
                       }
                   }
               }
          });
      }
  }

  // ... (methods)

  public play() {
      this.worker.postMessage({ type: 'PLAY' });
      this.startLoop(); 
  }

  public pause() {
      this.worker.postMessage({ type: 'PAUSE' });
      this.worker.postMessage({ type: 'PAUSE' }); 
  }

  public seek(time: number) {
      this.worker.postMessage({ type: 'SEEK', payload: time });
  }

  public setTimeUpdateCallback(cb: (time: number) => void) {
      this.onTimeUpdate = cb;
  }
  
  public setPreviewQuality(_quality: string) {
      // Stub
  }
  
  resize(width: number, height: number) {
      this.worker.postMessage({ type: 'RESIZE', payload: { width, height } });
  }

  // --- Main Thread Loop (Frame Pump) ---
  private startLoop() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.loop();
      this.start(); 
  }
  
  async start() {
       this.isRunning = true;
        window.addEventListener('frameflow:start-screen-share', (e: any) => {
            const { elementId } = e.detail;
            this.cameraManager.startScreenShare(elementId).catch(console.error);
        });
       this.loop();
  }
  
  stop() {
      this.isRunning = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.cameraManager.stopAll();
  }

  private loop = async () => {
      if (!this.isRunning) return;

      // 1. Pump Camera Frames
      const sources = this.cameraManager.getActiveSources();
      
      const framePromises = sources.map(async (source) => {
          if (source.videoElement && source.videoElement.readyState >= 2) {
              try {
                  const bitmap = await createImageBitmap(source.videoElement);
                  this.worker.postMessage({
                      type: 'CAMERA_FRAME',
                      payload: { id: source.id, bitmap }
                  }, [bitmap]);
              } catch (e) { }
          }
      });
      
      // 2. Pump Video Frames (Timeline + Scene)
      const videoPromises = this.pumpVideoFrames();
      
      await Promise.all([...framePromises, videoPromises]);
      
      this.rafId = requestAnimationFrame(this.loop);
  };

  private debugCounter = 0;

  private async pumpVideoFrames() {
      // Collect requirements
      const tasks: { assetId: string, time: number }[] = [];

      if (this.lastRenderMode === 'TIMELINE') {
           const { tracks, currentTime } = this.timelineState;
           for (const track of tracks) {
              if (track.type !== 'video' || track.isMuted) continue;
              for (const clip of track.clips) {
                  const clipEnd = clip.start + clip.duration;
                  if (currentTime >= clip.start && currentTime < clipEnd) {
                       const videoTime = (currentTime - clip.start + clip.offset) / 1000;
                       tasks.push({ assetId: clip.assetId, time: videoTime });
                  }
              }
           }
      } else if (this.activeCard) {
           // COMPOSITION Mode
           // Iterate scene elements
           this.activeCard.elements.forEach(el => {
               if (el.type === 'video') {
                   // For scene elements, assume looping or static? 
                   // Use global timeline time for now
                   const videoTime = (this.timelineState.currentTime / 1000);
                   tasks.push({ assetId: el.content, time: videoTime });
                   if (el.assetId && el.assetId !== el.content) {
                        tasks.push({ assetId: el.assetId, time: videoTime });
                   }
               }
           });
      }

      this.debugCounter++;
      if (this.debugCounter % 60 === 0) {
           // Log once per second approx
           console.log(`[VideoPump] Mode: ${this.lastRenderMode}, Tasks: ${tasks.length}`);
      }

      // Process Tasks
      for (const task of tasks) {
           let video = this.videoElements.get(task.assetId);
           
           if (!video) {
               try {
                   console.log(`[VideoPump] Initializing video for ${task.assetId}`);
                   video = document.createElement('video');
                   video.muted = true;
                   video.playsInline = true;
                   video.autoplay = false; 
                   video.loop = true; // Keep it alive
                   
                   const v = video; // Capture for closure
                   video.onerror = (_e) => console.error("[VideoPump] Video Error", v.error, task.assetId);

                   // video.style.display = 'none'; // Already in hidden container, but sure
                   
                   // Attach to DOM (Critical for some browsers)
                   this.videoContainer.appendChild(video);

                   // Load Asset
                   const asset = await db.getAsset(task.assetId);
                   if (asset && asset.blob) {
                       video.src = URL.createObjectURL(asset.blob);
                       video.load(); 
                       // Force play to pivot decoder
                       video.play().catch(e => console.error("[VideoPump] Auto-play failed", e));
                   } else {
                       console.warn(`[VideoPump] Asset not found or invalid: ${task.assetId}`);
                   }
                   this.videoElements.set(task.assetId, video);
               } catch (e) {
                   console.error("Failed to init video", task.assetId, e);
                   continue;
               }
           }

           if (video && video.readyState >= 1) { 
                // Sync Logic: Relaxed threshold to prevented stutter
                // Only seek if drift is significative (>250ms)
                if (Math.abs(video.currentTime - task.time) > 0.25) {
                    video.currentTime = task.time;
                }
                
                if (video.readyState >= 2) {
                     try {
                         const bitmap = await createImageBitmap(video);
                         this.worker.postMessage({
                             type: 'VIDEO_FRAME',
                             payload: { url: task.assetId, bitmap }
                         }, [bitmap]);
                     } catch (e) { 
                         console.error("Frame capture failed", e);
                     }
                }
           }
      }
  }
  
  // --- Stubbed Methods for now ---
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  getStream(): MediaStream {
      return this.canvas.captureStream(60);
  }
  
  async startRecording() {
      const stream = this.canvas.captureStream(60);
      try {
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      } catch (e) {
        // Fallback for browsers without VP9
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      }

      this.recordedChunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
              this.recordedChunks.push(e.data);
          }
      };
      this.mediaRecorder.start();
      console.log("Engine: Recording Started");
  }

  async stopRecording(): Promise<Blob> {
      return new Promise((resolve, reject) => {
          if (!this.mediaRecorder) {
              reject(new Error("No recording in progress"));
              return;
          }

          this.mediaRecorder.onstop = () => {
              const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
              this.recordedChunks = [];
              console.log("Engine: Recording Stopped, Blob Size:", blob.size);
              resolve(blob);
          };
          this.mediaRecorder.stop();
      });
  }

  async exportVideo(onProgress: (p: number) => void) {
      // Stub for future: Would likely use Whammy.js or WebCodecs in Worker
      console.warn("Export not fully implemented in Proxy Engine yet.");
      onProgress(100);
      return new Blob();
  }
}
