import { CameraManager } from './CameraManager';
import { AudioEngine } from './AudioEngine'; // New Import
// import { useAppStore } from '../stores/useAppStore'; // Store access might be needed for events
import { db } from '../db/FrameFlowDB';
import { eventBus } from '../services/EventBus'; 

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
  private audioEngine: AudioEngine; // New
  private activeCard: EngineCard | null = null;
  private isRunning: boolean = false;
  private videoContainer: HTMLDivElement;
  
  private videoElements = new Map<string, HTMLVideoElement>();
  private timelineState = { tracks: [] as any[], currentTime: 0, isPlaying: false };

  // Helper State
  private onTimeUpdate?: (time: number) => void;
  private rafId: number | null = null;
  private lastRenderMode: 'COMPOSITION' | 'TIMELINE' = 'COMPOSITION';

  // Shared Memory for Timeline State (fallback to null if not available)
  private sharedBuffer: SharedArrayBuffer | null = null;
  private sharedTimeView: Float64Array | null = null;
  private sharedStateView: Int32Array | null = null; // [isPlaying, ...]

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.cameraManager = new CameraManager();
    this.audioEngine = new AudioEngine(); 

    // Initialize Shared Buffer (1024 bytes)
    // Layout: 
    //   0-8: CurrentTime (Float64)
    //   8-12: IsPlaying (Int32)
    // SharedArrayBuffer requires COOP/COEP headers - graceful fallback if unavailable
    try {
      if (typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated) {
        this.sharedBuffer = new SharedArrayBuffer(1024);
        this.sharedTimeView = new Float64Array(this.sharedBuffer, 0, 1);
        this.sharedStateView = new Int32Array(this.sharedBuffer, 8, 1);
        console.log('[CompositionEngine] SharedArrayBuffer enabled for high-performance sync');
      } else {
        console.log('[CompositionEngine] SharedArrayBuffer not available, using message-based sync');
      }
    } catch (e) {
      console.warn('[CompositionEngine] SharedArrayBuffer initialization failed, using fallback:', e);
    }

    // Hidden Video Jail
    this.videoContainer = document.createElement('div');
    this.videoContainer.style.cssText = "position: fixed; top: -9999px; left: -9999px; width: 16px; height: 16px; opacity: 0; pointer-events: none; z-index: -1;";
    document.body.appendChild(this.videoContainer);

    // 1. Initialize Worker
    this.worker = new Worker(new URL('../frameflow.worker.ts', import.meta.url), { type: 'module' });

    // 2. Transfer Canvas AND SharedBuffer (if available)
    const offscreen = this.canvas.transferControlToOffscreen();
    this.worker.postMessage({ 
        type: 'INIT', 
        payload: { 
            canvas: offscreen,
            sharedBuffer: this.sharedBuffer // null if not available
        } 
    }, [offscreen]); // sharedBuffer is NOT transferable, it is shared.

    // 3. Listen
    this.worker.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'TIME_UPDATE') {
            // Message-based fallback for timeline sync
            this.timelineState.currentTime = payload;
            if (this.onTimeUpdate) this.onTimeUpdate(payload);
        } else if (type === 'GPU_CAPABILITIES') {
            eventBus.emit('GPU_CAPABILITIES', payload);
            console.log("Engine: Received GPU Capabilities", payload);
        }
    };
    
    // Start Polling Loop for Timeline Sync (only if SharedArrayBuffer is available)
    if (this.sharedStateView && this.sharedTimeView) {
      this.startSyncLoop();
    }
  }

  private startSyncLoop() {
      const loop = () => {
          if (this.sharedStateView && this.sharedStateView[0] === 1) { // IsPlaying
               this.timelineState.currentTime = this.sharedTimeView![0];
               eventBus.emit('TIME_UPDATE', this.timelineState.currentTime);
          }
          requestAnimationFrame(loop);
      };
      loop();
  }



  public play() {
      this.audioEngine.resume(); 
      this.worker.postMessage({ type: 'PLAY' });
      this.startLoop(); 
      eventBus.emit('PLAYBACK_STATE', 'playing');
  }

  public pause() {
      this.worker.postMessage({ type: 'PAUSE' });
      eventBus.emit('PLAYBACK_STATE', 'paused');
  }

  public seek(time: number) {
      this.worker.postMessage({ type: 'SEEK', payload: time });
      eventBus.emit('TIME_UPDATE', time);
  }

  public setTimeUpdateCallback(cb: (time: number) => void) {
      this.onTimeUpdate = cb;
  }

  public setFps(fps: number) {
      this.worker.postMessage({ type: 'SET_FPS', payload: fps });
  }
  
  public setPreviewQuality(_quality: string) {
      // Stub
  }

  public setCard(card: EngineCard | null) {
      this.activeCard = card;
      this.lastRenderMode = 'COMPOSITION';
      this.worker.postMessage({ type: 'SET_CARD', payload: card });
      
      // Auto-start cameras for camera elements
      if (card && card.elements) {
          card.elements.forEach(el => {
              if (el.type === 'camera') {
                  // Check if this camera is already active
                  const existingSource = this.cameraManager.getSource(el.id);
                  if (!existingSource) {
                      console.log('[CompositionEngine] Auto-starting camera for element:', el.id);
                      this.cameraManager.startCamera(el.id, (el as any).deviceId).catch(err => {
                          console.warn('[CompositionEngine] Failed to auto-start camera:', err);
                      });
                  }
              }
          });
      }
  }

  public setTimelineState(state: { tracks: any[], currentTime: number, isPlaying: boolean }) {
      this.timelineState = state;
      this.lastRenderMode = 'TIMELINE';
      this.worker.postMessage({ type: 'SET_TIMELINE', payload: state });
  }

  public setRenderMode(mode: 'COMPOSITION' | 'TIMELINE') {
      this.lastRenderMode = mode;
      this.worker.postMessage({ type: 'SET_RENDER_MODE', payload: mode });
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
  
  // Event handler references for cleanup
  private cameraEventHandler: ((e: Event) => void) | null = null;
  private screenShareEventHandler: ((e: Event) => void) | null = null;

  async start() {
       this.isRunning = true;
       
       // Remove any existing handlers first (in case of re-start)
       if (this.cameraEventHandler) {
           window.removeEventListener('frameflow:start-camera', this.cameraEventHandler);
       }
       if (this.screenShareEventHandler) {
           window.removeEventListener('frameflow:start-screen-share', this.screenShareEventHandler);
       }
       
       // Camera start event handler
       this.cameraEventHandler = (e: Event) => {
           const { elementId, deviceId } = (e as CustomEvent).detail;
           console.log('[CompositionEngine] Starting camera for element:', elementId, 'device:', deviceId);
           this.cameraManager.startCamera(elementId, deviceId).catch(console.error);
       };
       window.addEventListener('frameflow:start-camera', this.cameraEventHandler);
       
       // Screen share event handler
       this.screenShareEventHandler = (e: Event) => {
           const { elementId } = (e as CustomEvent).detail;
           this.cameraManager.startScreenShare(elementId).catch(console.error);
       };
       window.addEventListener('frameflow:start-screen-share', this.screenShareEventHandler);
       
       this.loop();
  }
  
  stop() {
      this.isRunning = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      
      // Remove event listeners
      if (this.cameraEventHandler) {
          window.removeEventListener('frameflow:start-camera', this.cameraEventHandler);
          this.cameraEventHandler = null;
      }
      if (this.screenShareEventHandler) {
          window.removeEventListener('frameflow:start-screen-share', this.screenShareEventHandler);
          this.screenShareEventHandler = null;
      }
      
      this.cameraManager.stopAll();
  }

  private loop = async () => {
      if (!this.isRunning) return;

      // 1. Pump Camera Frames
      const sources = this.cameraManager.getActiveSources();
      
      // Debug: Log active sources count occasionally
      if (Math.random() < 0.01) {
          console.log('[CompositionEngine] Active camera sources:', sources.length, sources.map(s => s.id));
      }
      
      const framePromises = sources.map(async (source) => {
          if (source.videoElement && source.videoElement.readyState >= 2) {
              try {
                  const bitmap = await createImageBitmap(source.videoElement);
                  this.worker.postMessage({
                      type: 'CAMERA_FRAME',
                      payload: { id: source.id, bitmap }
                  }, [bitmap]);
                  // Debug: Log frame sent (higher frequency)
                  if (Math.random() < 0.05) {
                      console.log('[CompositionEngine] ✓ Camera frame sent to worker for:', source.id);
                  }
              } catch (e) { 
                  console.warn('[CompositionEngine] Failed to create bitmap from camera:', e);
              }
          } else if (source.videoElement) {
              // Debug: Log why video not ready (ALWAYS for first few seconds)
              console.log('[CompositionEngine] Camera video not ready, readyState:', source.videoElement.readyState, 'for:', source.id);
          } else {
              console.log('[CompositionEngine] No video element for source:', source.id);
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
                   
                   const v = video; 
                   video.onerror = (_e) => console.error("[VideoPump] Video Error", v.error, task.assetId);

                   // Attach to DOM 
                   this.videoContainer.appendChild(video);

                    // Load Asset
                    const asset = await db.getAsset(task.assetId);
                    if (asset) {
                        if (asset.proxyPath) {
                             console.log(`[VideoPump] Using Proxy for ${task.assetId}`);
                             video.src = `frameflow://${encodeURIComponent(asset.proxyPath)}`;
                        } else if (asset.path) {
                             video.src = `frameflow://${encodeURIComponent(asset.path)}`;
                        } else if (asset.blob) {
                             video.src = URL.createObjectURL(asset.blob);
                        }
                        
                        video.load(); 
                        video.play().catch(() => {}); // Attempt play
                        
                        // Setup rVFC Loop for this video
                        const onFrame = (_now: number, _metadata: VideoFrameCallbackMetadata) => {
                             if (!this.videoElements.has(task.assetId)) return; // Stopped?
                             
                             createImageBitmap(v).then(bitmap => {
                                 this.worker.postMessage({
                                     type: 'VIDEO_FRAME',
                                     payload: { url: task.assetId, bitmap }
                                 }, [bitmap]);
                             }).catch(_e => {}); // Ignore closed/empty errors
                             
                             if (v.requestVideoFrameCallback) {
                                 v.requestVideoFrameCallback(onFrame);
                             }
                        };
                        
                        if (video.requestVideoFrameCallback) {
                            video.requestVideoFrameCallback(onFrame);
                        }
                    } else {
                        console.warn(`[VideoPump] Asset not found or invalid: ${task.assetId}`);
                    }
                   this.videoElements.set(task.assetId, video);
                   this.audioEngine.connectVideo(video, 'video-master'); 
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
                
                // Fallback for browsers without rVFC (e.g. Firefox had late support, mostly ok now)
                if (!video.requestVideoFrameCallback && video.readyState >= 2) {
                     try {
                         const bitmap = await createImageBitmap(video);
                         this.worker.postMessage({
                             type: 'VIDEO_FRAME',
                             payload: { url: task.assetId, bitmap }
                         }, [bitmap]);
                     } catch (e) {}
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
