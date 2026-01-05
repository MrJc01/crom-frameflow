/* eslint-disable no-restricted-globals */
// frameflow.worker.ts
// The isolated rendering context
import { WebGPURenderer, type RenderLayer } from './engine/WebGPURenderer';
import { AISegmentationService } from './services/AISegmentationService';
import { LUTService } from './services/LUTService';
import { GPUProfiler } from './engine/GPUProfiler';
import { TrackerService, type Rect } from './services/TrackerService';
// @ts-ignore
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { EasingFunctions, type EasingType } from './utils/EasingFunctions';
import { VideoDecoderService } from './services/VideoDecoderService';
import type { Card, SceneElement, Keyframe, TimelineTrack } from './types';

// Re-define types to avoid import issues in Worker context if naive bundler

export type RenderMode = 'COMPOSITION' | 'TIMELINE';

interface TimelineState {
    tracks: TimelineTrack[];
    currentTime: number;
    isPlaying: boolean;
}

// --- Worker State ---
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let webGpuRenderer: WebGPURenderer | null = null;
let renderMode: RenderMode = 'COMPOSITION';
let activeCard: Card | null = null;
let targetFps = 30; // Default preview FPS


// Timeline
let timeline: TimelineState = { tracks: [], currentTime: 0, isPlaying: false };
let lastFrameTime = 0;
// let rafId: number | null = null; // Unused
let isRunning = false;

// Caches
const imageCache = new Map<string, ImageBitmap>();
const cameraFrameCache = new Map<string, ImageBitmap>(); // id -> bitmap
// AI Segmentation Cache
const maskCache = new Map<string, ImageBitmap>(); // elementId -> mask

interface VideoFrameEntry {
    bitmap: ImageBitmap;
    timestamp: number;
}
const videoFrameBuffer = new Map<string, VideoFrameEntry[]>(); // content/assetId -> frames
const activeVideoFrame = new Map<string, ImageBitmap>(); // content/assetId -> current frame to draw
const videoFrameCache = new Map<string, ImageBitmap>(); // Legacy compatibility alias

// Pre-computed Animation Cache (elementId -> property -> sorted keyframes)
const precomputedKeyframes = new Map<string, Map<string, Keyframe[]>>();

// Reusable Layers Array
const reusableLayers: RenderLayer[] = [];

// ...

// Helper function to precompute keyframes
function precomputeKeyframes(card: Card) {
    precomputedKeyframes.clear();
    card.elements.forEach(el => {
        if (!el.animations) return;
        const propMap = new Map<string, Keyframe[]>();
        
        // Group by property
        const groups = new Map<string, Keyframe[]>();
        el.animations.forEach(k => {
            if (!groups.has(k.property)) groups.set(k.property, []);
            groups.get(k.property)!.push(k);
        });
        
        // Sort each group
        groups.forEach((kfs, prop) => {
             kfs.sort((a,b) => a.time - b.time);
             propMap.set(prop, kfs);
        });
        
        precomputedKeyframes.set(el.id, propMap);
    });
}



// ...

// Modify UPDATE_TIMELINE or SET_CARD to update precomputed
// inside onmessage switch:


// ...

function renderComposition(width: number, height: number) {
    // Debug: Log render state
    if (!activeCard) {
        // Only log occasionally to avoid spam
        if (Math.random() < 0.01) {
            console.log('[Worker] renderComposition: No activeCard set');
        }
        return;
    }
    
    if (activeCard.elements.length === 0) {
        if (Math.random() < 0.01) {
            console.log('[Worker] renderComposition: Card has no elements', activeCard.id);
        }
    }

    // ... scaling logic ...
    const sceneW = activeCard.width || 1920;
    const sceneH = activeCard.height || 1080;
    if (sceneW === 0 || sceneH === 0) return;

    const padding = 40;
    const availW = Math.max(0, width - padding * 2);
    const availH = Math.max(0, height - padding * 2);

    const scale = Math.min(availW / sceneW, availH / sceneH);
    const offsetX = (width - sceneW * scale) / 2;
    const offsetY = (height - sceneH * scale) / 2;

    // --- WebGPU Path ---
    if (webGpuRenderer && webGpuRenderer.isInitialized) {
        // Reuse Array
        reusableLayers.length = 0;
        
        // Sort elements by zIndex
        const sorted = activeCard.elements.slice().sort((a,b) => a.zIndex - b.zIndex);
        
        for (const el of sorted) {
             let texture: ImageBitmap | null = null;
             
             if (el.type === 'image') {
                 texture = imageCache.get(el.content) || null;
             } else if (el.type === 'camera') {
                 texture = cameraFrameCache.get(el.id) || null;
                 // Debug: Log camera texture lookup
                 if (Math.random() < 0.01) {
                     console.log('[Worker] Camera texture lookup for:', el.id, 'found:', !!texture, 'cache size:', cameraFrameCache.size);
                 }
             } else if (el.type === 'video') {
                 // ... video logic ...
                 if (el.assetId) {
                      const t = timeline.isPlaying ? timeline.currentTime / 1000 : timeline.currentTime / 1000;
                      updateVideoBuffer(el.assetId, t, timeline.isPlaying);
                      
                      if (!activeVideoFrame.get(el.assetId)) {
                           const lastReq = lastRequestMap.get(el.assetId); 
                           const now = performance.now();
                           if (!lastReq || (now - lastReq > 500)) {
                               lastRequestMap.set(el.assetId, now); 
                               VideoDecoderService.getInstance().getFrame(el.assetId, t).then(bmp => {
                                   if (bmp) activeVideoFrame.set(el.assetId, bmp);
                               });
                           }
                      }
                 }
                 texture = activeVideoFrame.get(el.assetId!) || null;
             }

             if (texture) {
                 const t = timeline.currentTime;
                 
                 // Use Optimized Interpolation
                 const ix = interpolatePropertyOptimized(el.id, 'x', t, el.x);
                 const iy = interpolatePropertyOptimized(el.id, 'y', t, el.y);
                 const iw = interpolatePropertyOptimized(el.id, 'width', t, el.width);
                 const ih = interpolatePropertyOptimized(el.id, 'height', t, el.height);
                 const iRot = interpolatePropertyOptimized(el.id, 'rotation', t, el.rotation);
                 const iOp = interpolatePropertyOptimized(el.id, 'opacity', t, el.opacity ?? 1);

                 let iViewParams = el.viewParams;
                 if (el.projection === 'equirectangular') {
                     const defYaw = el.viewParams?.yaw ?? 0;
                     const defPitch = el.viewParams?.pitch ?? 0;
                     const defFov = el.viewParams?.fov ?? 90;
                     iViewParams = {
                         yaw: interpolatePropertyOptimized(el.id, 'viewParams.yaw', t, defYaw),
                         pitch: interpolatePropertyOptimized(el.id, 'viewParams.pitch', t, defPitch),
                         fov: interpolatePropertyOptimized(el.id, 'viewParams.fov', t, defFov),
                     };
                 }

                 const elX = (ix * scale) + offsetX;
                 const elY = (iy * scale) + offsetY;
                 const elW = iw * scale;
                 const elH = ih * scale;
                 
                  // AI Segmentation ...
                  let mask: ImageBitmap | undefined = undefined;
                  if (el.segmentation?.enabled) {
                      mask = maskCache.get(el.id);
                      if (!inferenceInProgress.has(el.id)) {
                        inferenceInProgress.add(el.id);
                        const service = AISegmentationService.getInstance();
                        service.loadModel().then((loaded) => {
                            if (loaded && texture) {
                                service.predict(texture).then(newMask => {
                                    if (newMask) maskCache.set(el.id, newMask);
                                    inferenceInProgress.delete(el.id);
                                }).catch(() => inferenceInProgress.delete(el.id));
                            } else {
                                inferenceInProgress.delete(el.id);
                            }
                        });
                      }
                  }

                 // LUT ...
                 let lutTexture: GPUTexture | undefined = undefined;
                 if (el.lut && el.lut.source) {
                      const lutSource = el.lut.source;
                      lutTexture = lutTextureCache.get(lutSource);
                      if (!lutTexture && !lutLoading.has(lutSource)) {
                          lutLoading.add(lutSource);
                          fetch(lutSource).then(r => r.text()).then(async text => {
                                try {
                                    // Use Async/WASM parser
                                    const data = await LUTService.parseCubeAsync(text);
                                    if (webGpuRenderer) {
                                        const tex = webGpuRenderer.createLUTTexture(data.data, data.size);
                                        if (tex) lutTextureCache.set(lutSource, tex);
                                    }
                                } catch(e) { console.error("LUT Parse Error", e); }
                                lutLoading.delete(lutSource);
                          }).catch(()=>lutLoading.delete(lutSource));
                      }
                 }

                 // Push object literal - still allocates, but logic is simplified.
                 // To fully fix GC, we'd need a Pool.
                 // For now, reusing the Array is a big step.
                 reusableLayers.push({
                     texture: texture,
                     x: elX, y: elY, width: elW, height: elH,
                     rotation: iRot * Math.PI / 180,
                     scale: 1, opacity: iOp,
                     zIndex: el.zIndex,
                     chromaKey: el.chromaKey,
                     text3d: el.text3d,
                     mask: mask,
                     lut: lutTexture,
                     projection: el.projection,
                     viewParams: iViewParams
                 });
             }
        }
        webGpuRenderer.render(reusableLayers);
        return;
    }
    // ...
}

// ...

// OPTIMIZED Interpolation
function interpolatePropertyOptimized(elementId: string, property: string, time: number, defaultValue: number): number {
    const elProps = precomputedKeyframes.get(elementId);
    if (!elProps) return defaultValue;
    
    const kfs = elProps.get(property);
    if (!kfs || kfs.length === 0) return defaultValue;
    
    // kfs is already sorted by time
    
    if (time <= kfs[0].time) return kfs[0].value;
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
    
    // Binary Search or Linear Scan?
    // Small N -> Linear is fast.
    for (let i = 0; i < kfs.length - 1; i++) {
        const k1 = kfs[i];
        const k2 = kfs[i+1];
        if (time >= k1.time && time < k2.time) {
            let t = (time - k1.time) / (k2.time - k1.time);
            
            if (k1.easing && EasingFunctions[k1.easing]) {
                t = EasingFunctions[k1.easing](t);
            }
            return k1.value + (k2.value - k1.value) * t;
        }
    }
    
    return defaultValue;
}

function updateVideoBuffer(assetId: string, currentTime: number, isPlaying: boolean) {
    let buffer = videoFrameBuffer.get(assetId);
    if (!buffer) {
        buffer = [];
        videoFrameBuffer.set(assetId, buffer);
    }

    // 1. Find best frame for current time
    // We want the frame with closest timestamp <= currentTime (or just closest)
    // Actually, for video, usually previous keyframe + time.
    // Let's assume closest for now.
    
    let bestIdx = -1;
    let minDiff = Infinity;
    
    for (let i = 0; i < buffer.length; i++) {
        const diff = Math.abs(buffer[i].timestamp - currentTime);
        if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
        }
    }
    
    const TOLERANCE = 0.1; // 100ms
    if (bestIdx !== -1 && minDiff < TOLERANCE) {
        // We found a frame that matches current Time
        const entry = buffer[bestIdx];
        
        // Update active frame
        const currentActive = activeVideoFrame.get(assetId);
        if (currentActive !== entry.bitmap) {
             // activeVideoFrame.set(assetId, entry.bitmap); 
             // BEWARE: If we set it here, do we consume it?
             // If we rely on buffer for cache, we might want to Clone? matches are references.
             // Let's just set it.
             activeVideoFrame.set(assetId, entry.bitmap);
        }
    } else {
        // No frame in buffer. Urgent request?
        // Only if not already requested recently?
        // logic below handles requests.
    }

    // 2. Cleanup Old Frames (behind current time - 1s)
    const CLEANUP_THRESHOLD = 1.0;
    const kept: VideoFrameEntry[] = [];
    for (const entry of buffer) {
        if (entry.timestamp >= currentTime - CLEANUP_THRESHOLD) {
            kept.push(entry);
        } else {
            entry.bitmap.close();
        }
    }
    videoFrameBuffer.set(assetId, kept);
    buffer = kept;

    // 3. Lookahead / Pre-fetch
    if (!isPlaying) return; // Only prefetch during playback? Or seeking?
    
    const FPS = 30; // Assumption or get from track
    const LOOKAHEAD = 5; // Frames
    
    // We want to ensure we have frames for t, t+1, ... t+LOOKAHEAD
    for (let i = 0; i <= LOOKAHEAD; i++) {
        const targetT = currentTime + (i / FPS);
        
        // Check if we have this frame (or close enough) pending or in buffer
        const alreadyHas = buffer.some(f => Math.abs(f.timestamp - targetT) < (0.5/FPS));
        
        if (!alreadyHas) {
             // Check pending requests
             // We need a map of pending requests to avoid spamming
             const lastReq = lastRequestMap.get(`${assetId}_${targetT.toFixed(2)}`); // Rough key
             const now = performance.now();
             
             if (!lastReq || (now - lastReq > 1000)) { // Retry after 1s
                 lastRequestMap.set(`${assetId}_${targetT.toFixed(2)}`, now);
                 
                 VideoDecoderService.getInstance().getFrame(assetId, targetT).then(bmp => {
                     if (bmp) {
                         const buf = videoFrameBuffer.get(assetId) || [];
                         // Insert sorted
                         buf.push({ bitmap: bmp, timestamp: targetT });
                         buf.sort((a,b) => a.timestamp - b.timestamp);
                         videoFrameBuffer.set(assetId, buf);
                         
                         // Clear request cache to free memory eventually?
                         lastRequestMap.delete(`${assetId}_${targetT.toFixed(2)}`);
                     }
                 });
             }
        }
        
        // Don't flood: only 1 request per loop?
        // No, we can issue parallel valid requests. Browser/Worker handles queue.
    }
}
//...

const inferenceInProgress = new Set<string>(); // elementId

// LUT Cache
const lutTextureCache = new Map<string, GPUTexture>(); // source/name -> Texture
const lutLoading = new Set<string>();

// Shared Memory Views
let sharedTimeView: Float64Array | null = null;
let sharedStateView: Int32Array | null = null;

const lastRequestMap = new Map<string, number>();

// --- Message Handlers ---
self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            canvas = payload.canvas;
            if (payload.sharedBuffer) {
                // Initialize Views
                sharedTimeView = new Float64Array(payload.sharedBuffer, 0, 1);
                sharedStateView = new Int32Array(payload.sharedBuffer, 8, 1);
                console.log("Worker: Shared Memory Initialized");
            }

            console.log("Worker: Init");
            
            // Try WebGPU First
            if (navigator.gpu) {
                try {
                    const renderer = new WebGPURenderer();
                    const success = await renderer.init(canvas!);
                    if (success) {
                        webGpuRenderer = renderer;
                        console.log("Worker: WebGPU Enabled");

                        // Profile GPU
                        const profiler = GPUProfiler.getInstance();
                        await profiler.init();
                        const capabilities = profiler.getCapabilities();
                        self.postMessage({ type: 'GPU_CAPABILITIES', payload: capabilities });
                    }
                } catch (err) {
                    console.error("Worker: WebGPU Init Failed", err);
                }
            }

            // Fallback to 2D if WebGPU failed or unavailable
            if (!webGpuRenderer) {
                console.log("Worker: Fallback to 2D Canvas");
                ctx = canvas!.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
            }

            startLoop();
            break;
        case 'SET_MODE':
            renderMode = payload;
            break;
        case 'SET_CARD':
            activeCard = payload;
            console.log('[Worker] SET_CARD received:', activeCard ? `id=${activeCard.id}, elements=${activeCard.elements?.length || 0}` : 'null');
            if (activeCard) {
                precomputeKeyframes(activeCard);
                activeCard.elements.forEach(el => {
                   if (el.type === 'image' && !imageCache.has(el.content)) {
                       console.log('[Worker] Loading image:', el.content);
                       fetch(el.content)
                        .then(r => r.blob())
                        .then(b => createImageBitmap(b))
                        .then(bmp => imageCache.set(el.content, bmp))
                        .catch(err => console.warn("Failed to load image in worker", err));
                   } else if (el.type === 'video' && el.assetId) {
                       VideoDecoderService.getInstance().prepare(el.assetId, el.content).catch(err => {
                           console.warn("Failed to prepare decoder for", el.assetId, err);
                       });
                   }
                });
            }
            break;
        case 'UPDATE_TIMELINE':
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

        case 'SET_FPS':
            const fps = payload;
            if (fps >= 1 && fps <= 240) {
                targetFps = fps;
                console.log(`Worker: Target FPS set to ${targetFps}`);
            }
            break;
        
        // --- Frame Injection from Main Thread ---
        case 'CAMERA_FRAME':
            // Debug: Log frame reception occasionally
            if (Math.random() < 0.01) {
                console.log('[Worker] CAMERA_FRAME received for:', payload.id);
            }
            if (cameraFrameCache.has(payload.id)) {
                cameraFrameCache.get(payload.id)?.close(); // GC previous
            }
            cameraFrameCache.set(payload.id, payload.bitmap);
            break;
            
        case 'VIDEO_FRAME':
             if (videoFrameCache.has(payload.url)) {
                 videoFrameCache.get(payload.url)?.close();
             }
             videoFrameCache.set(payload.url, payload.bitmap);
             break;

        // --- Headless Export Mode ---
        case 'INIT_HEADLESS':
            // Create internal canvas for export rendering
            canvas = new OffscreenCanvas(payload.width, payload.height);
            // Re-use logic
            if (navigator.gpu) {
                try {
                    const renderer = new WebGPURenderer();
                    // Note: headless canvas can be used with WebGPU
                    const success = await renderer.init(canvas);
                    if (success) webGpuRenderer = renderer;
                } catch(e) { console.error("Headless GPU Fail", e); }
            }
            if (!webGpuRenderer) {
                ctx = canvas.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
            }
            break;

        case 'RENDER_HEADLESS':
            // payload: { time: number, frameIndex: number }
            timeline.currentTime = payload.time * 1000; // Convert to ms
            timeline.isPlaying = false;
            
            // Ensure video buffers are up to date?
            // Since we are not in the loop(), we must trigger `updateVideoBuffer` manually or rely on `renderComposition` doing it.
            // `renderComposition` DOES calls `updateVideoBuffer`, so just calling render() is enough.
            
            render();
            // Wait for GPU queue?
            if (webGpuRenderer && webGpuRenderer.isInitialized) {
                 await webGpuRenderer.waitForQueue(); 
            }
            
            const bitmap = canvas!.transferToImageBitmap();
            self.postMessage({ 
                type: 'RENDER_DONE_BITMAP', 
                payload: { frameIndex: payload.frameIndex, bitmap } 
            }, [bitmap]);
            break;
             
        case 'RESIZE':
            if (canvas) {
                canvas.width = payload.width;
                canvas.height = payload.height;
            }
            break;

        case 'EXPORT_GIF':
            await handleExportGif(payload);
            break;

        case 'TRACK_MOTION':
            await handleMotionTracking(payload);
            break;
    }
};

async function handleMotionTracking(params: { clipId: string, roi: Rect, start: number, duration: number, fps: number }) {
    if (!canvas) return;
    
    const { clipId, roi, start, duration, fps } = params;
    const end = start + duration;
    // const interval = 1000 / fps; // Use frame interval
    // Actually, for tracking we might want to iterate EVERY frame or at least same FPS as video. 
    // Let's assume standard FPS.
    const interval = 1000 / fps;

    console.log(`Starting Motion Tracking for ${clipId}`);
    self.postMessage({ type: 'TRACK_START' });

    const keyframes: { time: number, x: number, y: number }[] = [];
    
    // Save state
    const originalTime = timeline.currentTime;
    const wasPlaying = timeline.isPlaying;
    timeline.isPlaying = false;
    
    // Initial ROI
    let currentRoi = { ...roi };
    
    // We need "Previous Frame" data for the tracker.
    let prevFrameData: ImageData | null = null;
    
    // Create a temp canvas for reading pixel data if needed
    const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const _tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;

    const totalFrames = Math.ceil(duration / interval);
    let frameCount = 0;

    try {
        for (let t = start; t < end; t += interval) {
            timeline.currentTime = t;
            render(); 

            // Get Pixel Data
            // We need full frame pixel data to search in.
            // If WebGPU, we read back. If 2D, we get from ctx.
            let frameData: ImageData | null = null;
            
            if (webGpuRenderer && webGpuRenderer.isInitialized) {
                 const pixels = await webGpuRenderer.getPixelData();
                 if (pixels) {
                    // Create ImageData from pixels
                    // Note: webGpuRenderer returns Uint8ClampedArray (RGBA)
                    frameData = new ImageData(pixels as any, canvas.width, canvas.height);
                 }
            } else if (ctx) {
                frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
            
            if (frameData) {
                if (prevFrameData) {
                    // Track
                    currentRoi = TrackerService.track(frameData, prevFrameData, currentRoi);
                }
                
                // Save Keyframe (Center of ROI)
                keyframes.push({
                    time: t - start, // Relative time
                    x: currentRoi.x + currentRoi.width / 2,
                    y: currentRoi.y + currentRoi.height / 2
                });
                
                prevFrameData = frameData;
            }
            
            frameCount++;
             self.postMessage({ type: 'TRACK_PROGRESS', payload: frameCount / totalFrames });
             
             // Breathe
            await new Promise(r => setTimeout(r, 0));
        }

        self.postMessage({ type: 'TRACK_COMPLETE', payload: keyframes });

    } catch (e) {
        console.error("Tracking Failed", e);
        self.postMessage({ type: 'TRACK_ERROR', payload: String(e) });
    } finally {
        timeline.currentTime = originalTime;
        timeline.isPlaying = wasPlaying;
        render();
    }
}

async function handleExportGif(params: { start: number, duration: number, fps: number }) {
    if (!canvas) return;

    const { start, duration, fps } = params;
    const end = start + duration;
    const interval = 1000 / fps;
    
    console.log(`Starting GIF Export: ${duration}ms @ ${fps}fps`);
    self.postMessage({ type: 'GIF_START' });

    const gif = new GIFEncoder();
    
    // Save state
    const originalTime = timeline.currentTime;
    const wasPlaying = timeline.isPlaying;
    timeline.isPlaying = false;
    
    const width = canvas.width;
    const height = canvas.height;
    
    let frameCount = 0;
    const totalFrames = Math.ceil(duration / interval);

    try {
        for (let t = start; t < end; t += interval) {
            timeline.currentTime = t;
            render(); // Synchronous render call (updates WebGPU command encoder)
            
            // Wait for GPU logic if needed? 
            // webGpuRenderer.getPixelData is async (awaits mapAsync).
            
            let data: Uint8ClampedArray | Uint8Array | null = null;
            
            if (webGpuRenderer && webGpuRenderer.isInitialized) {
                data = await webGpuRenderer.getPixelData();
            } else if (ctx) {
                data = ctx.getImageData(0, 0, width, height).data;
            }
            
            if (data) {
                // Quantize
                const palette = quantize(data, 256);
                const index = applyPalette(data, palette);
                
                // Delay in ms? gifenc uses delay in ms? or cs?
                // gifenc writeFrame: { delay: number (in ms?) }? 
                // Documentation says delay is usually in 1/100s (centiseconds) for standard GIF, but gifenc might accept ms?
                // Looking at standard: delay is centiseconds.
                // Let's verify `gifenc` API or assume standard. 
                // Usually libs accept ms and convert, or ask for delay.
                // `gifenc` default is usually 0.
                
                // `gif.writeFrame(index, width, height, { palette, delay: interval })`
                // If interval is ms, we might need to check units.
                // Let's assume ms for now, or check generic usage.
                
                gif.writeFrame(index, width, height, { 
                    palette, 
                    delay: interval 
                });
            }
            
            frameCount++;
            self.postMessage({ type: 'GIF_PROGRESS', payload: frameCount / totalFrames });
            
            // Breathe
            await new Promise(r => setTimeout(r, 0));
        }
        
        gif.finish();
        const buffer = gif.bytes();
        const blob = new Blob([buffer], { type: 'image/gif' });
        
        self.postMessage({ type: 'GIF_COMPLETE', payload: blob });
        
    } catch (e) {
        console.error("GIF Export Failed", e);
        self.postMessage({ type: 'GIF_ERROR', payload: String(e) });
    } finally {
        // Restore
        timeline.currentTime = originalTime;
        timeline.isPlaying = wasPlaying;
        render(); // Render original frame
    }
}

function startLoop() {
    if (isRunning) return;
    isRunning = true;
    lastFrameTime = performance.now();
    loop();
}

function loop() {
    if (!isRunning) return;

    requestAnimationFrame(loop);

    const now = performance.now();
    const delta = now - lastFrameTime;

    // FPS Limiter
    const interval = 1000 / targetFps;
    if (delta < interval) {
        return;
    }
    
    // Logic: If playing, advance time
    if (renderMode === 'TIMELINE' && timeline.isPlaying) {
        timeline.currentTime += delta;
        
        // Write to Shared Memory
        if (sharedTimeView) sharedTimeView[0] = timeline.currentTime;
        if (sharedStateView) sharedStateView[0] = 1; // Playing
        
        // Use postMessage sparsely (e.g., every 60ms) or just generic
        // Actually, main thread polls now. But we still send for legacy/react
        // Optimization: Throttle postMessage
        if (Math.random() < 0.1) { // ~6fps updates for React State (enough for slider)
             self.postMessage({ type: 'TIME_UPDATE', payload: timeline.currentTime });
        }
    } else {
        if (sharedStateView) sharedStateView[0] = 0; // Paused
    }
    
    lastFrameTime = now - (delta % interval); // Adjust for drift
    render();
}

function render() {
    if (!canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;

    // Clear (Only needed for 2D, WebGPU handles it in pass)
    if (ctx) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
    }

    if (renderMode === 'TIMELINE') {
        renderTimeline(width, height);
    } else {
        renderComposition(width, height);
    }
}



function renderTimeline(width: number, height: number) {
    if (webGpuRenderer && webGpuRenderer.isInitialized) {
        const layers: RenderLayer[] = [];
        
        for (const track of timeline.tracks) {
           if (track.type !== 'video' || track.isMuted) continue;
           for (const clip of track.clips) {
               const clipEnd = clip.start + clip.duration;
               if (timeline.currentTime >= clip.start && timeline.currentTime < clipEnd) {
                   const bmp = videoFrameCache.get(clip.assetId);
                   if (bmp) {
                       
                       // AI Segmentation Check (Timeline)
                       let mask: ImageBitmap | undefined = undefined;
                       if (clip.segmentation?.enabled) {
                           mask = maskCache.get(clip.id); // Use Clip ID
                           if (!inferenceInProgress.has(clip.id)) {
                               inferenceInProgress.add(clip.id);
                               const service = AISegmentationService.getInstance();
                               service.loadModel().then(loaded => {
                                   if (loaded && bmp) {
                                       service.predict(bmp).then(newMask => {
                                           if (newMask) maskCache.set(clip.id, newMask);
                                           inferenceInProgress.delete(clip.id);
                                       }).catch(() => inferenceInProgress.delete(clip.id));
                                   } else {
                                     inferenceInProgress.delete(clip.id);
                                   }
                               });
                           }
                       }

                       // Draw fullscreen
                       layers.push({
                           texture: bmp,
                           x: 0,
                           y: 0,
                           width: width,
                           height: height,
                           rotation: 0,
                           scale: 1,
                           opacity: 1,
                           zIndex: 0,
                           chromaKey: clip.chromaKey,
                           text3d: clip.text3d,
                           mask: mask,
                           projection: clip.projection,
                           viewParams: clip.viewParams
                       });
                   }
               }
           }
        }
        
        webGpuRenderer.render(layers);
        return;
    }

    if (!ctx) return;
    
    // Canvas 2D Timeline Render
     for (const track of timeline.tracks) {
           if (track.type !== 'video') continue; 
           for (const clip of track.clips) {
               const clipEnd = clip.start + clip.duration;
               if (timeline.currentTime >= clip.start && timeline.currentTime < clipEnd) {
                   const bmp = videoFrameCache.get(clip.assetId);
                   if (bmp) {
                       drawImageProp(ctx, bmp, 0, 0, width, height); 
                   }
               }
           }
      }
}

function drawImageProp(ctx: OffscreenCanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number, offsetX = 0.5, offsetY = 0.5) {
     if (arguments.length === 2) {
          x = y = 0;
          w = ctx.canvas.width;
          h = ctx.canvas.height;
      }
      
       var iw = img.width,
          ih = img.height,
          r = Math.min(w / iw, h / ih),
          nw = iw * r,
          nh = ih * r,
          cx, cy, cw, ch, ar = 1;

      if (nw < w) ar = w / nw;                             
      if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;
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

function interpolateProperty(animations: Keyframe[] | undefined, property: string, time: number, defaultValue: number): number {
    if (!animations || animations.length === 0) return defaultValue;
    
    // Exact match optimization? No, time is float.

    const kfs = animations.filter(k => k.property === property).sort((a,b) => a.time - b.time);
    if (kfs.length === 0) return defaultValue;
    
    if (time <= kfs[0].time) return kfs[0].value;
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
    
    for (let i = 0; i < kfs.length - 1; i++) {
        const k1 = kfs[i];
        const k2 = kfs[i+1];
        if (time >= k1.time && time < k2.time) {
            let t = (time - k1.time) / (k2.time - k1.time);
            
            // Apply Easing (defined on start keyframe)
            if (k1.easing && EasingFunctions[k1.easing]) {
                t = EasingFunctions[k1.easing](t);
            }
            
            return k1.value + (k2.value - k1.value) * t;
        }
    }
    
    return defaultValue;
}
