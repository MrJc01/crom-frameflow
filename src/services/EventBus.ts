type Handler<T = any> = (payload: T) => void;

export class EventBus<Events extends Record<string, any>> {
    private handlers: Map<keyof Events, Set<Handler>> = new Map();

    on<K extends keyof Events>(event: K, handler: Handler<Events[K]>) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler);
        
        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    off<K extends keyof Events>(event: K, handler: Handler<Events[K]>) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.handlers.delete(event);
            }
        }
    }

    emit<K extends keyof Events>(event: K, payload: Events[K]) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.forEach(h => {
                try {
                    h(payload);
                } catch (e) {
                    console.error(`[EventBus] Error in handler for ${String(event)}:`, e);
                }
            });
        }
    }

    clear() {
        this.handlers.clear();
    }
}

// Global instance type definition
export interface AppEvents {
    'TIME_UPDATE': number; // Current time in ms
    'PLAYBACK_STATE': 'playing' | 'paused';
    'AUDIO_LEVELS': Record<string, number>; // trackId -> rms level (0-1)
    'RENDER_STATS': { fps: number; memory: number; droppedFrames: number };
    'ERROR': { code: string; message: string };
    'EXPORT_PROGRESS': number; // 0-100
    'GPU_CAPABILITIES': any; // GPUCapabilities
}

export const eventBus = new EventBus<AppEvents>();
