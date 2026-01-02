import { CameraManager } from './CameraManager';

// Duplicate of Store types to avoid circular dependencies if strict, 
// or just re-define for Engine isolation.
export interface SceneElement {
  id: string;
  type: 'camera' | 'image' | 'text';
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
}

export interface EngineCard {
    id: string;
    type: 'scene';
    elements: SceneElement[];
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get canvas context');
    this.context = ctx;
    
    this.cameraManager = new CameraManager();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    await this.cameraManager.start();
    
    this.isRunning = true;
    this.loop();
  }

  setCard(card: EngineCard | null) {
      this.activeCard = card;
      // Preload images
      if (card) {
          card.elements.forEach(el => {
              if (el.type === 'image' && !this.imageCache.has(el.content)) {
                  const img = new Image();
                  img.src = el.content;
                  img.onload = () => { /* loaded */ };
                  this.imageCache.set(el.content, img);
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
    this.cameraManager.stop();
    
    if (this.context instanceof CanvasRenderingContext2D || this.context instanceof OffscreenCanvasRenderingContext2D) {
       this.context.fillStyle = '#000';
       this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private loop = async () => {
    if (!this.isRunning) return;
    await this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private async render() {
    const video = this.cameraManager.getVideoElement();
    const { width, height } = this.canvas;
    const ctx = this.context as CanvasRenderingContext2D;

    // 1. (AI Process Removed)

    // 2. Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // 3. Render Scene
    if (this.activeCard) {
        // Sort elements by zIndex (Ensure numbers)
        const sortedElements = [...this.activeCard.elements].sort((a, b) => Number(a.zIndex) - Number(b.zIndex));

        for (const el of sortedElements) {
            ctx.save();
            
            // Apply Transform
            // Pivot is usually center? Or top-left?
            // Let's assume Top-Left for now, but Center is better for rotation.
            // If data model x/y is Top-Left:
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            
            ctx.translate(cx, cy);
            ctx.rotate(el.rotation * Math.PI / 180);
            ctx.translate(-cx, -cy);

            if (el.type === 'camera') {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    this.drawImageProp(ctx, video, el.x, el.y, el.width, el.height);
                } else {
                    ctx.fillStyle = '#222';
                    ctx.fillRect(el.x, el.y, el.width, el.height);
                }
            } else if (el.type === 'image') {
                const img = this.imageCache.get(el.content);
                if (img && img.complete) {
                    this.drawImageProp(ctx, img, el.x, el.y, el.width, el.height);
                } else {
                    ctx.fillStyle = '#333';
                    ctx.fillRect(el.x, el.y, el.width, el.height);
                    ctx.fillStyle = '#fff';
                    ctx.fillText("Loading...", el.x + 10, el.y + 20);
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
                
                // Multiline support could be added here later
                ctx.fillText(el.content, el.x, el.y);
                ctx.restore();
            }

            ctx.restore();
        }
    } else {
        // Default View: Full Screen Camera
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            this.drawImageProp(ctx, video, 0, 0, width, height);
        }
    }

    // 4. Draw FPS
    const now = performance.now();
    this.fps = Math.round(1000 / (now - this.lastFrameTime));
    this.lastFrameTime = now;

    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`FPS: ${this.fps}`, 20, 40);
  }

  
  // ... drawImageProp and resize methods remain the same ...
  /**
   * Helper to draw image cover (like CSS object-fit: cover)
   */
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
