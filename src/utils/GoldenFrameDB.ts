/**
 * Golden Frames Database
 * System for validating render fidelity against known "golden" frames
 */

export interface GoldenFrame {
    id: string;
    description: string;
    timestamp: number; // millisecond in timeline
    hash: string; // CRC32 or simple pixel hash
    dataUrl?: string; // Optional: store actual image for visual debug
}

export class GoldenFrameDB {
    private frames: Map<string, GoldenFrame> = new Map();
    private storageKey = 'frameflow-golden-frames';

    constructor() {
        this.load();
    }

    /**
     * Load DB from local storage
     */
    private load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    parsed.forEach((frame: GoldenFrame) => {
                        this.frames.set(frame.id, frame);
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to load Golden Frames DB', e);
        }
    }

    /**
     * Save DB to local storage
     */
    save() {
        try {
            const data = Array.from(this.frames.values());
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save Golden Frames DB', e);
        }
    }

    /**
     * Calculate a simple hash for a canvas
     * Note: For production, use a robust hashing lib. This is a quick pixel-sum hash.
     */
    async computeHash(canvas: HTMLCanvasElement): Promise<string> {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let hash = 0;
        for (let i = 0; i < data.length; i += 4) {
            // Check every 4th byte (alpha) isn't 0, just sum rgba
            if (data[i+3] > 0) {
                 hash = (hash + data[i] + data[i+1] + data[i+2]) | 0;
            }
        }
        return hash.toString(16);
    }

    /**
     * Capture a frame as "Golden"
     */
    async captureGoldenFrame(id: string, canvas: HTMLCanvasElement, timestamp: number, description: string) {
        const hash = await this.computeHash(canvas);
        const dataUrl = canvas.toDataURL('image/png', 0.5); // Low quality preview

        const frame: GoldenFrame = {
            id,
            description,
            timestamp,
            hash,
            dataUrl
        };

        this.frames.set(id, frame);
        this.save();
        console.log(`🌟 Captured Golden Frame: ${id} (${hash})`);
    }

    /**
     * Compare current canvas against golden frame
     */
    async validateFrame(id: string, canvas: HTMLCanvasElement): Promise<{ passed: boolean; diff: string }> {
        const golden = this.frames.get(id);
        if (!golden) {
            return { passed: false, diff: `Golden frame '${id}' not found` };
        }

        const currentHash = await this.computeHash(canvas);
        
        if (currentHash === golden.hash) {
            return { passed: true, diff: 'Exact match' };
        }

        return { 
            passed: false, 
            diff: `Hash mismatch! Expected ${golden.hash}, got ${currentHash}` 
        };
    }

    /**
     * Get all stored frames
     */
    getAllFrames(): GoldenFrame[] {
        return Array.from(this.frames.values());
    }
    
    /**
     * Clear DB
     */
    clear() {
        this.frames.clear();
        localStorage.removeItem(this.storageKey);
    }
}

// Singleton for easy access
export const goldenDB = new GoldenFrameDB();
