import { pipeline, env } from '@xenova/transformers';

// Skip local check for models in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface CaptionItem {
    id: string;
    start: number;
    end: number;
    text: string;
}

class CaptionServiceClass {
    private pipe: any = null;
    private isModelLoading = false;

    /**
     * Initialize the Whisper pipeline
     */
    async init() {
        if (this.pipe) return;
        if (this.isModelLoading) return;

        try {
            this.isModelLoading = true;
            // 'Xenova/whisper-tiny' is about 40MB quantized
            this.pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
            console.log('[CaptionService] Model loaded');
        } catch (e) {
            console.error('[CaptionService] Failed to load model', e);
            throw e;
        } finally {
            this.isModelLoading = false;
        }
    }

    /**
     * Transcribe an audio buffer (Float32Array)
     * Note: Transformers.js expects audio sampled at 16000Hz.
     * We need to resample if source is different.
     */
    async transcribe(audioData: Float32Array, sampleRate: number): Promise<CaptionItem[]> {
        await this.init();

        // Resample native rate to 16kHz
        const audio16k = await this.resampleTo16k(audioData, sampleRate);

        const result = await this.pipe(audio16k, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true
        });

        // Parse result
        // Result format: { text: "...", chunks: [{ timestamp: [start, end], text: "..." }] }
        
        const captions: CaptionItem[] = [];
        const chunks = result.chunks || [];

        chunks.forEach((chunk: any, i: number) => {
            if (chunk.timestamp) {
                const [start, end] = chunk.timestamp;
                captions.push({
                    id: `auto-${Date.now()}-${i}`,
                    start: start ?? 0,
                    end: end ?? (start + 1),
                    text: chunk.text.trim()
                });
            }
        });

        return captions;
    }

    /**
     * Resample audio to 16000Hz using OfflineAudioContext
     */
    private async resampleTo16k(audioData: Float32Array, originalSampleRate: number): Promise<Float32Array> {
        if (originalSampleRate === 16000) return audioData;

        const duration = audioData.length / originalSampleRate;
        const offlineCtx = new OfflineAudioContext(1, duration * 16000, 16000);
        
        const buffer = offlineCtx.createBuffer(1, audioData.length, originalSampleRate);
        const channelData = buffer.getChannelData(0);
        channelData.set(audioData);

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start();

        const renderedBuffer = await offlineCtx.startRendering();
        return renderedBuffer.getChannelData(0);
    }
}

export const CaptionService = new CaptionServiceClass();
