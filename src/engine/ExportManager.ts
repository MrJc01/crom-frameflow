/**
 * ExportManager - Multi-threaded Video Export
 * 
 * This manager spawns a dedicated export worker that orchestrates
 * a pool of render workers for parallel frame generation.
 */

export interface ExportConfig {
    width: number;
    height: number;
    fps: number;
    duration: number; // in seconds
    timeline: any;
    activeCard: any;
}

export interface ExportProgress {
    progress: number; // 0-1
    currentFrame?: number;
    totalFrames?: number;
}

type ExportEventHandler = {
    onProgress?: (progress: ExportProgress) => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
};

export class ExportManager {
    private worker: Worker | null = null;
    private handlers: ExportEventHandler = {};
    private isExporting = false;

    constructor() {}

    /**
     * Start a multi-threaded export
     */
    async startExport(config: ExportConfig, handlers: ExportEventHandler): Promise<void> {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        this.handlers = handlers;
        this.isExporting = true;

        // Spawn the export worker
        this.worker = new Worker(
            new URL('../workers/export.worker.ts', import.meta.url),
            { type: 'module' }
        );

        // Handle messages from worker
        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;

            switch (type) {
                case 'PROGRESS':
                    this.handlers.onProgress?.({
                        progress: payload.progress ?? payload,
                        currentFrame: payload.currentFrame,
                        totalFrames: payload.totalFrames
                    });
                    break;

                case 'COMPLETE':
                    this.isExporting = false;
                    this.handlers.onComplete?.();
                    this.cleanup();
                    break;

                case 'ERROR':
                    this.isExporting = false;
                    this.handlers.onError?.(payload);
                    this.cleanup();
                    break;
            }
        };

        this.worker.onerror = (e) => {
            this.isExporting = false;
            this.handlers.onError?.(`Worker error: ${e.message}`);
            this.cleanup();
        };

        // Start export
        this.worker.postMessage({
            type: 'START',
            payload: config
        });
    }

    /**
     * Cancel ongoing export
     */
    cancel(): void {
        if (this.worker) {
            this.worker.postMessage({ type: 'CANCEL' });
            this.cleanup();
        }
        this.isExporting = false;
    }

    /**
     * Check if export is in progress
     */
    get exporting(): boolean {
        return this.isExporting;
    }

    private cleanup(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Singleton instance for easy access
let instance: ExportManager | null = null;

export function getExportManager(): ExportManager {
    if (!instance) {
        instance = new ExportManager();
    }
    return instance;
}

