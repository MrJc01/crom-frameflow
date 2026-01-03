import * as MP4Box from 'mp4box';

export class ExportManager {
    private videoEncoder: VideoEncoder | null = null;
    private mp4File: any = null;
    private trackId: number | null = null;
    private frameCounter = 0;
    private width: number;
    private height: number;
    private fps: number;

    constructor(width: number, height: number, fps: number) {
        this.width = width;
        this.height = height;
        this.fps = fps;
    }

    async initialize() {
        // 1. Setup MP4Box
        this.mp4File = MP4Box.createFile();
        
        // 2. Setup VideoEncoder
        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                if (meta) {
                    this.handleEncodedChunk(chunk, meta);
                } else {
                     console.error("Missing metadata for chunk");
                }
            },
            error: (e) => console.error("VideoEncoder error:", e)
        });

        const config: VideoEncoderConfig = {
            codec: 'avc1.42001f', // H.264 Baseline Profile Level 3.1
            width: this.width,
            height: this.height,
            bitrate: 5_000_000, // 5 Mbps
            framerate: this.fps,
        };

        const support = await VideoEncoder.isConfigSupported(config);
        if (!support.supported) {
            throw new Error(`Video Config not supported: ${JSON.stringify(config)}`);
        }

        this.videoEncoder.configure(config);
        console.log("ExportManager Initialized", config);
    }

    private handleEncodedChunk(chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata) {
        // Init Track if needed
        if (this.trackId === null && meta && meta.decoderConfig) {
             // Convert decoderConfig.description (AVCC) to ArrayBuffer if needed
             const description = meta.decoderConfig.description as ArrayBuffer;
             
             this.trackId = this.mp4File.addTrack({
                 timescale: 1000, // milliseconds
                 width: this.width,
                 height: this.height,
                 nb_samples: 0,
                 avcDecoderConfigRecord: description, // Important for H.264
                 media_duration: 0, // will update
                 type: 'video',
                 codec: 'avc1',
             });
        }

        if (this.trackId !== null) {
            const buffer = new Uint8Array(chunk.byteLength);
            chunk.copyTo(buffer);

            // MP4Box expects sample duration
            // We assume constant FPS for now
            const duration = 1000 / this.fps;

            this.mp4File.addSample(this.trackId, buffer, {
                duration: duration,
                dts: chunk.timestamp / 1000, // Convert to MS if needed? usually timestamp is microseconds
                cts: chunk.timestamp / 1000,
                is_sync: chunk.type === 'key'
            });
        }
    }

    async encodeFrame(canvas: HTMLCanvasElement, timestamp: number) {
        if (!this.videoEncoder) throw new Error("Encoder not initialized");

        // Create VideoFrame from Canvas
        // Timestamp must be in microseconds for VideoFrame
        const frame = new VideoFrame(canvas, { timestamp: timestamp * 1000 });
        
        // Encode
        // keyFrame every 2 seconds (2 * fps)
        const keyFrame = this.frameCounter % (this.fps * 2) === 0;
        this.videoEncoder.encode(frame, { keyFrame });
        
        frame.close();
        this.frameCounter++;

        // Wait for encoding queue to not be full?
        if (this.videoEncoder.encodeQueueSize > 20) {
            await this.videoEncoder.flush();
        }
    }

    async download() {
        if (!this.videoEncoder) return;
        
        await this.videoEncoder.flush();
        
        // Create Blob
        // MP4Box requires us to "save" to a buffer or handle the stream
        // simpler approach: mp4File.save() triggers a download in browser usually, 
        // OR we can tap into 'onReady' of file?
        // MP4Box.js documentation implies we need to be careful.
        
        // Actually `save` in mp4box.js usually creates a UInt8Array of the file.
        // We will wrap it in a promise.
        
        return new Promise<Blob>((resolve) => {
             this.mp4File.onReady = (info: any) => {
                 console.log("MP4 Info", info);
             };
             
             // mp4box does not have a simple "getBlob"
             // We have to rely on it writing to memory output if initialized with valid options
             // The workaround is to create a custom stream or let it flush.

             // Let's use the simplest .save() from types if available, 
             // but usually we need to capture the buffer.
             
             this.mp4File.save("export.mp4");
             // The save method in mp4box.js triggers a download directly via a link click.
             
             // If we want the blob programmatically:
             // We need to subclass the file or read its buffer.
             // For now, let's rely on .save() for immediate gratification.
             resolve(new Blob([], { type: 'video/mp4' }));
        });
    }

    async finish(): Promise<void> {
        if (this.videoEncoder) {
            await this.videoEncoder.flush();
            this.videoEncoder.close();
        }
        this.mp4File.save("frameflow-export.mp4");
    }
}
