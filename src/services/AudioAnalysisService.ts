
export class AudioAnalysisService {
    private audioContext: AudioContext;

    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    /**
     * Decodes audio data from a Blob and extracts peaks for visualization.
     * @param blob Audio or Video blob containing audio track
     * @param samples Number of data points to return (resolution of waveform)
     */
    async extractPeaks(blob: Blob, samples: number = 100): Promise<number[]> {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            return this.computePeaks(audioBuffer, samples);
        } catch (e) {
            console.error("Failed to decode audio data", e);
            return [];
        }
    }

    private computePeaks(buffer: AudioBuffer, samples: number): number[] {
        const channelData = buffer.getChannelData(0); // Use first channel (Left or Mono)
        const blockSize = Math.floor(channelData.length / samples);
        const peaks: number[] = [];

        for (let i = 0; i < samples; i++) {
            const start = i * blockSize;
            let sum = 0;
            
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[start + j]);
            }
            
            // Average amplitude for this block
            peaks.push(sum / blockSize);
        }

        // Normalize
        const max = Math.max(...peaks, 0.001); // Avoid div by zero
        return peaks.map(p => p / max);
    }
}

export const audioAnalysis = new AudioAnalysisService();
