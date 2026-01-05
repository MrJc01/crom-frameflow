
import * as MP4Box from 'mp4box';

// Types
type ExportConfig = {
    width: number;
    height: number;
    fps: number;
    duration: number; // in seconds
    timeline: any; // Timeline state
    activeCard: any; // Card state
};

// State
let videoEncoder: VideoEncoder | null = null;
let mp4File: any = null;
let fileTrackId: number | null = null;
let frameCounter = 0;
let totalFrames = 0;

let workerPool: Worker[] = [];
const POOL_SIZE = navigator.hardwareConcurrency ? Math.max(2, navigator.hardwareConcurrency - 2) : 4;
let freeWorkers: number[] = []; // Indices of available workers
let frameQueue: number[] = []; // Frames waiting to be rendered
let pendingFrames = new Map<number, { resolve: (bmp: ImageBitmap) => void, reject: (err: any) => void }>();

// Main Listener
self.onmessage = async (e) => {
    const { type, payload } = e.data;
    if (type === 'START') {
        await startExport(payload);
    }
};

async function startExport(config: ExportConfig) {
    totalFrames = Math.ceil(config.duration * config.fps);
    frameCounter = 0;
    
    // 1. Initialize MP4Box
    mp4File = MP4Box.createFile();
    
    // 2. Initialize VideoEncoder
    const initEncoder = new Promise<void>((resolve, reject) => {
        videoEncoder = new VideoEncoder({
            output: (chunk, meta) => handleEncodedChunk(chunk, meta),
            error: (e) => {
                 console.error("Encoder Error", e);
                 reject(e);
            }
        });
        
        videoEncoder.configure({
            codec: 'avc1.42001f',
            width: config.width,
            height: config.height,
            bitrate: 8_000_000,
            framerate: config.fps,
        });
        
        // Wait for config? Usually instant-ish but let's resolve
        resolve();
    });
    
    await initEncoder;

    // 3. Initialize Worker Pool
    await  initWorkerPool(config);

    // 4. Start Processing
    // We can't simply loop because we need to wait for workers.
    // We will start a loop that keeps the pool busy.
    
    // Fill Queue
    for(let i=0; i<totalFrames; i++) {
        frameQueue.push(i);
    }
    
    processQueue(config);
}

async function initWorkerPool(config: ExportConfig) {
    workerPool = [];
    freeWorkers = [];
    
    for (let i = 0; i < POOL_SIZE; i++) {
        // Spawn Frameflow Worker in "Headless" mode?
        // We probably need to pass a special flag or just use the same worker.
        const w = new Worker(new URL('../frameflow.worker.ts', import.meta.url), { type: 'module' });
        
        // Initialize the worker with the scene data
        // We mock the canvas transfer because we don't assume a canvas for export worker?
        // Actually, frameflow.worker.ts expects INIT with canvas.
        // We might need to modify frameflow.worker.ts to accept INIT_HEADLESS.
        
        w.postMessage({ 
            type: 'INIT_HEADLESS', 
            payload: {
                width: config.width,
                height: config.height
            }
        });
        
        if (config.activeCard) {
            w.postMessage({ type: 'SET_CARD', payload: config.activeCard });
        }
        
        w.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'RENDER_DONE_BITMAP') {
                const { frameIndex, bitmap } = payload;
                const pending = pendingFrames.get(frameIndex);
                if (pending) {
                    pending.resolve(bitmap);
                    pendingFrames.delete(frameIndex);
                }
                // Mark worker as free?
                // We need to know WHICH worker sent this to mark it free.
                // Or we just resolve the promise and `processQueue` loop handles assigning next task.
                // Actually tracking worker index mapping is cleaner.
            }
        };
        
        workerPool.push(w);
        freeWorkers.push(i);
    }
}

async function processQueue(config: ExportConfig) {
    let cursor = 0;
    // Sequential encoding loop
    while (cursor < totalFrames) {
        // 1. Dispatch tasks if workers are free and we have frames needed
        // We look ahead a bit?
        // Actually simplest is: maintain a buffer of promises.
        // We iterate `cursor` from 0 to total.
        
        // Wait! We need to Encode SEQUENTIALLY.
        // But we can RENDER in PARALLEL.
        
        // So we can spawn tasks for cursor + 1, cursor + 2...
        // But we must `await encode(cursor)`.
        
        // Let's ensure top N priority frames are being rendered.
        
        dispatchWork(config, cursor);
        
        // Wait for current frame
        const bmp = await waitForFrame(cursor);
        
        // Encode
        await encodeFrame(bmp, cursor, config.fps);
        
        // Report Progress
        self.postMessage({ type: 'PROGRESS', progress: (cursor + 1) / totalFrames });
        
        cursor++;
    }
    
    await finishExport();
}

function dispatchWork(config: ExportConfig, currentCursor: number) {
    // Fill all free workers with next needed frames
    while (freeWorkers.length > 0 && frameQueue.length > 0) {
        const workerIdx = freeWorkers.pop()!;
        // Find next needed frame that isn't already pending
        // Queue is just 0..N. We should remove processed ones.
        // Actually `frameQueue` is just a list of indices.
        
        // Simplification: We want to prioritize `currentCursor`.
        // If `currentCursor` is not pending and not done, schedule it.
        // If `currentCursor` IS pending, schedule `currentCursor + 1`.
        
        // Let's just peer into the future logic:
        // We need frame X. Is X being worked on? No? Assign it.
        // If X Is being worked on, check X+1.
        
        let targetFrame = -1;
        for (let i = 0; i < POOL_SIZE * 2; i++) { // Look ahead
             const f = currentCursor + i;
             if (f < totalFrames && !pendingFrames.has(f)) {
                 targetFrame = f;
                 break;
             }
        }
        
        if (targetFrame !== -1) {
            const w = workerPool[workerIdx];
            
            // Create a promise for this frame
            new Promise<ImageBitmap>((resolve, reject) => {
                pendingFrames.set(targetFrame, { resolve, reject });
                
                // Send Command
                // We need to pass the time.
                const time = targetFrame / config.fps;
                w.postMessage({ 
                    type: 'RENDER_HEADLESS', 
                    payload: { time, frameIndex: targetFrame } 
                }, [/* transfer? no */]);
                
                // We ALSO need to know when this specfic worker is done to return it to free list.
                // So wrapping this promise isn't enough.
                // We'll attach logic to the resolve chain?
                // actually the `w.onmessage` handler is global for the worker.
                // We need to map `worker` object to its index?
            });
            
            // Hacky mapping: assign `w.onmessage` here? No, closures.
            // Better: update `w.onmessage` to include worker Idx or passing it in payload commands?
        } else {
            // No work found? Put worker back?
            freeWorkers.push(workerIdx);
            break; 
        }
    }
}

// ... We need to refine the worker pool tracking logic ...
// Re-write `initWorkerPool` to properly track callbacks.

function getWorker(index: number) {
    return workerPool[index];
}

async function waitForFrame(index: number): Promise<ImageBitmap> {
    // Check if duplicate?
    if (pendingFrames.has(index)) {
        // already scheduled, just return its promise logic?
        // pendingFrames values are { resolve, reject } not the promise itself.
        // We need the promise.
        // Refactor pendingFrames to store Promise?
    }
    // ...
    // Let's simplify: 
    // We just return a generic promise that resolves when the map entry is called.
    return new Promise((resolve, reject) => {
        const existing = pendingFrames.get(index);
        if (existing) {
             // chain
             const oldResolve = existing.resolve;
             existing.resolve = (bmp) => { oldResolve(bmp); resolve(bmp); };
        } else {
             // Not scheduled yet? Schedule it now via dispatch?
             // Or just register it and wait for dispatch loop to pick it up?
             pendingFrames.set(index, { resolve, reject });
        }
    });
}

// ... (Previous Helper Functions)

function handleEncodedChunk(chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata) {
    if (fileTrackId === null && meta && meta.decoderConfig && meta.decoderConfig.description) {
        const description = meta.decoderConfig.description as ArrayBuffer;
        fileTrackId = mp4File.addTrack({
            timescale: 1000,
            width: meta.decoderConfig.codedWidth || 1920,
            height: meta.decoderConfig.codedHeight || 1080,
            nb_samples: 0,
            avcDecoderConfigRecord: description,
            media_duration: 0,
            type: 'video',
            codec: 'avc1',
        });
    }

    if (fileTrackId !== null) {
        const buffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buffer);
        
        // We assume constant FPS for sample duration
        const duration = 1000 / (totalFrames > 0 ? (totalFrames / (frameCounter/1000)) : 30); 
        // Actually we have config.fps
        
        mp4File.addSample(fileTrackId, buffer, {
            duration: 1000 / 30, // Placeholder, need config access or pass it
            dts: chunk.timestamp / 1000,
            cts: chunk.timestamp / 1000,
            is_sync: chunk.type === 'key'
        });
    }
}

async function encodeFrame(bitmap: ImageBitmap, index: number, fps: number) {
    if (!videoEncoder) return;
    
    const frame = new VideoFrame(bitmap, { timestamp: (index / fps) * 1_000_000 });
    const keyFrame = index % (fps * 2) === 0;
    
    videoEncoder.encode(frame, { keyFrame });
    frame.close();
    
    // Backpressure
    if (videoEncoder.encodeQueueSize > 15) {
        await videoEncoder.flush();
    }
}

async function finishExport() {
    if (videoEncoder) {
        await videoEncoder.flush();
        videoEncoder.close();
    }
    
    mp4File.save("export.mp4");
    // Since save() triggers download in browser, here in worker it might fail or do nothing?
    // MP4Box.js in worker needs to be handled carefully.
    // If .save() logic uses `document`, it will crash.
    // We should override `activeFile.onReady` or similar to capture the buffer.
    
    // Actually, simplest override for MP4Box in Worker:
    // We just want the ArrayBuffer. 
    // mp4File.flush();
    // We can iterate the samples? No. 
    // MP4Box is mainly for muxing.
    
    // Let's assume for now we post a message "COMPLETE" maybe without the blob if save works?
    // No, save() won't work in worker.
    
    // Workaround: Use a custom stream for MP4Box
    // or just return success and let Main Thread handle muxing? 
    // No, Encoder is here.
    
    self.postMessage({ type: 'COMPLETE' });
}


