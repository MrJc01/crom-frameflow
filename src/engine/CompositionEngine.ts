import { CameraManager } from './CameraManager';

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get canvas context');
    this.context = ctx;
    
    this.cameraManager = new CameraManager();
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
    
    if (this.context instanceof CanvasRenderingContext2D || this.context instanceof OffscreenCanvasRenderingContext2D) {
       this.context.fillStyle = '#000';
       this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // --- Recording API ---
  private mediaRecorder: MediaRecorder | null = null;
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

  private loop = async () => {
    if (!this.isRunning) return;
    await this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private async render() {
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
             
             // Draw Infinite Grid (Optional) or Void
             // ...

             // Draw "Broadcast Guide" (The active output area relative to screen 0,0)
             // In Infinite Mode, we assume the camera is "looking at" the canvas.
             // The output is what falls within [0,0, width, height] of the CANVAS (if canvas is 1080p)
             // OR relative to the viewport settings.
             
             // Let's assume the "Output Frame" matches the Card Resolution (e.g., 1920x1080)
             // and is anchored at (0,0) of the *Canvas/Screen*, effectively making the window a "portal".
             // As you pan, the world slides past this portal.
             
             const outW = this.activeCard.width || 1920;
             const outH = this.activeCard.height || 1080;
             
             // Draw Dark Overlay outside the active area (Letterboxing/Windowing effect)
             ctx.save();
             ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
             
             // Top
             if (height > outH) ctx.fillRect(0, outH, width, height - outH);
             // Right
             if (width > outW) ctx.fillRect(outW, 0, width - outW, height);
             
             // Note: If canvas < output, we just don't see the overlay.
             
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
                
                // Check readyState: 2 = HAVE_CURRENT_DATA, 4 = HAVE_ENOUGH_DATA
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
