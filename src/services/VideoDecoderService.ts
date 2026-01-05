import MP4Box, { type MP4File, type MP4Info, type MP4Track, type MP4Sample } from 'mp4box';

interface DecoderState {
    url: string;
    file: MP4File;
    info: MP4Info | null;
    videoTrack: MP4Track | null;
    decoder: VideoDecoder | null;
    pending: Map<number, (frame: ImageBitmap | null) => void>;
    samples: MP4Sample[];
    description: Uint8Array | null;
    readyPromise: Promise<boolean>;
    lastDecodeSampleIndex: number;
}

export class VideoDecoderService {
    private static instance: VideoDecoderService;
    private states = new Map<string, DecoderState>();
    
    private constructor() {}

    static getInstance() {
        if (!this.instance) this.instance = new VideoDecoderService();
        return this.instance;
    }

    async prepare(assetId: string, url: string): Promise<boolean> {
        if (this.states.has(assetId)) return this.states.get(assetId)!.readyPromise;

        let resolveReady: (value: boolean | PromiseLike<boolean>) => void;
        let rejectReady: (reason?: any) => void;
        const readyPromise = new Promise<boolean>((resolve, reject) => {
            resolveReady = resolve;
            rejectReady = reject;
        });

        const mp4boxfile = MP4Box.createFile();
        const state: DecoderState = {
            url,
            file: mp4boxfile,
            info: null,
            videoTrack: null,
            decoder: null,
            pending: new Map(),
            samples: [],
            description: null,
            readyPromise,
            lastDecodeSampleIndex: -1
        };
        
        this.states.set(assetId, state);

        mp4boxfile.onError = (e: any) => {
            console.error(`[VideoDecoderService] MP4Box Error for ${assetId}:`, e);
            rejectReady(e);
        };

        mp4boxfile.onReady = (info: MP4Info) => {
            state.info = info;
            const track = info.tracks.find((t) => t.codec.startsWith('avc1') || t.codec.startsWith('hvc1') || t.codec.startsWith('vp'));
            if (track) {
                state.videoTrack = track;
                // DO NOT set extraction options for everything.
                // We just want samples metadata.
                // MP4Box parses samples table in 'moov'.
                mp4boxfile.setExtractionOptions(track.id, null, { nbSamples: 1000 }); // Extract initial samples if in moov
                mp4boxfile.start();
            } else {
                rejectReady(new Error("No suitable video track found"));
            }
        };

        mp4boxfile.onSamples = (id: number, user: any, newSamples: MP4Sample[]) => {
            // Merge samples logic: avoid duplicates if we fetch overlapping chunks
            // For now, we assume simple append or we might need a more complex store.
            // MP4Box onSamples is called when it parses a 'moof' or 'mdat' AND we asked for extraction.
            // But we actually want to just have the sample table.
            
            // Note: If fast-start (fragmented or not), we get samples from moov.
            // We'll store what we get.
            
            for (const s of newSamples) {
                // Check if we already have this sample
                if (!state.samples[s.number]) {
                    state.samples[s.number] = s;
                }
            }
            
            if (!state.decoder && state.videoTrack) {
                 try {
                     this.initDecoder(state, assetId);
                     resolveReady(true);
                 } catch (e) {
                     rejectReady(e);
                 }
            }
        };

        // Fetch Initial Chunk (Header/Moov) - e.g. 5MB
        // Ideally we should start small and seek for moov if not found.
        // But for simplicity/MVP, 10MB is safe for most local MP4s.
        const CHUNK_SIZE = 10 * 1024 * 1024; 
        
        fetch(url, { headers: { 'Range': `bytes=0-${CHUNK_SIZE}` } })
            .then(res => {
                if (res.status === 206 || res.status === 200) {
                     return res.arrayBuffer();
                }
                throw new Error(`Failed to fetch initial chunk ${res.status}`);
            })
            .then(buffer => {
                (buffer as any).fileStart = 0;
                mp4boxfile.appendBuffer(buffer);
                mp4boxfile.flush();
            })
            .catch(e => {
                console.error(`[VideoDecoderService] Fetch Error for ${assetId}:`, e);
                rejectReady(e);
            });

        return readyPromise;
    }

    private initDecoder(state: DecoderState, assetId: string) {
        if (!state.videoTrack) return;

        state.decoder = new VideoDecoder({
            output: (frame) => {
                const frameTime = frame.timestamp / 1_000_000;
                const tolerance = 0.05;
                const resolvedTimes: number[] = [];

                for (const [reqTime, resolve] of state.pending.entries()) {
                    if (Math.abs(frameTime - reqTime) < tolerance) {
                        createImageBitmap(frame).then(resolve).catch(e => {
                            console.error("Failed to create bitmap", e);
                            resolve(null);
                        });
                        resolvedTimes.push(reqTime);
                    }
                }
                
                resolvedTimes.forEach(t => state.pending.delete(t));
                frame.close(); 
            },
            error: (e) => {
                console.error(`[VideoDecoderService] Decoder Error ${assetId}:`, e);
            }
        });

        // Config
        let description: Uint8Array | undefined = undefined;
        // @ts-ignore
        const avcc = state.file.getTrackById(state.videoTrack.id)?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.avcC;
        if (avcc) {
             const StreamClass = (MP4Box as any).DataStream;
             const stream = new StreamClass(undefined, 0, StreamClass.BIG_ENDIAN);
             avcc.write(stream);
             description = new Uint8Array(stream.buffer, 8);
        }

        const config: VideoDecoderConfig = {
            codec: state.videoTrack.codec,
            codedWidth: state.videoTrack.track_width,
            codedHeight: state.videoTrack.track_height,
            description: description
        };
        
        try {
            state.decoder.configure(config);
        } catch (e) {
             console.error(`[VideoDecoderService] Configure failed for ${assetId}`, config, e);
             throw e;
        }
    }

    async getFrame(assetId: string, timeSeconds: number): Promise<ImageBitmap | null> {
         const state = this.states.get(assetId);
         if (!state || !state.decoder || !state.videoTrack) return null;

         if (state.decoder.state === 'closed') return null;

         const timescale = state.videoTrack.timescale;
         const timeTicks = timeSeconds * timescale;

         // 1. Find target sample using Track Information
         // @ts-ignore
         const trackSamples = state.file.getTrackSamplesInfo(state.videoTrack.id);
         if (!trackSamples || trackSamples.length === 0) return null;

         let targetSampleIndex = -1;
         
         // Binary search
         let low = 0, high = trackSamples.length - 1;
         while (low <= high) {
             const mid = Math.floor((low + high) / 2);
             const s = trackSamples[mid];
             if (timeTicks >= s.cts && timeTicks < s.cts + s.duration) {
                 targetSampleIndex = mid;
                 break;
             } else if (timeTicks < s.cts) {
                 high = mid - 1;
             } else {
                 low = mid + 1;
             }
         }
         
         if (targetSampleIndex === -1 && trackSamples.length > 0) {
             targetSampleIndex = trackSamples.length - 1; 
         }

         if (targetSampleIndex === -1) return null;

         // Determine start sample
         // If target is just after last decoded, continue.
         // Else, find keyframe.
         let startSampleIndex = -1;
         
         // Check if sequential
         if (state.lastDecodeSampleIndex !== -1 && 
             targetSampleIndex > state.lastDecodeSampleIndex && 
             targetSampleIndex <= state.lastDecodeSampleIndex + 10 // small gap tolerance
            ) {
             startSampleIndex = state.lastDecodeSampleIndex + 1;
         } else {
             // Seek/Random Access: Find preceding sync sample
             for (let i = targetSampleIndex; i >= 0; i--) {
                 if (trackSamples[i].is_sync) {
                     startSampleIndex = i;
                     break;
                 }
             }
             if (startSampleIndex === -1) startSampleIndex = 0;
         }

         // Update last decode index to target (optimistically assuming success)
         state.lastDecodeSampleIndex = targetSampleIndex;

         // If start > target, we already decoded it?
         if (startSampleIndex > targetSampleIndex) {
             // Just wait for pending if exists
             return new Promise<ImageBitmap | null>((resolve) => {
                 if (state.pending.has(timeSeconds)) {
                     // Already pending, replace callback or chain it? (Map overwrites)
                     // Ideally we add to existing listener list.
                     // For now, simpler: just wait.
                 }
                 state.pending.set(timeSeconds, resolve);
                 // Add timeout?
                 setTimeout(() => { if(state.pending.has(timeSeconds)) resolve(null); }, 1000); 
             });
         }

         // 3. Fetch data for samples [startSampleIndex...targetSampleIndex]
         const startSample = trackSamples[startSampleIndex];
         const endSample = trackSamples[targetSampleIndex];
         
         const startByte = startSample.offset;
         const endByte = endSample.offset + endSample.size - 1;
         
         let chunkData: ArrayBuffer;
         try {
             chunkData = await fetch(state.url, {
                 headers: { 'Range': `bytes=${startByte}-${endByte}` }
             }).then(r => r.arrayBuffer());
         } catch(e) {
             console.error("Fetch failed", e);
             return null;
         }
         
         const dataView = new DataView(chunkData);

         return new Promise<ImageBitmap | null>((resolve) => {
             const timeoutId = setTimeout(() => {
                 if (state.pending.has(timeSeconds)) {
                     state.pending.delete(timeSeconds);
                     resolve(null);
                 }
             }, 3000);

             state.pending.set(timeSeconds, (frame) => {
                 clearTimeout(timeoutId);
                 resolve(frame);
             });

             for (let i = startSampleIndex; i <= targetSampleIndex; i++) {
                 const s = trackSamples[i];
                 const type: EncodedVideoChunkType = s.is_sync ? 'key' : 'delta';
                 
                 const offsetInChunk = s.offset - startByte;
                 const sampleData = new Uint8Array(chunkData, offsetInChunk, s.size);
                 
                 const chunk = new EncodedVideoChunk({
                     type: type,
                     timestamp: (s.cts / timescale) * 1_000_000,
                     duration: (s.duration / timescale) * 1_000_000,
                     data: sampleData
                 });
                 
                 if (state.decoder && state.decoder.state === 'configured') {
                    state.decoder.decode(chunk);
                 }
             }
         });
    }
}
