/**
 * Recovery Service
 * Auto-save and crash recovery for FrameFlow
 */

const STORAGE_KEY = 'frameflow-recovery';
const CRASH_FLAG_KEY = 'frameflow-crash-flag';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export interface RecoveryState {
    timestamp: number;
    projectId?: string;
    cards: any[];
    timeline: any;
    activeCardId: string | null;
    version: number;
}

export interface RecoveryInfo {
    hasRecoveryData: boolean;
    timestamp?: Date;
    description?: string;
}

class RecoveryServiceClass {
    private autoSaveInterval: number | null = null;
    private isRecovering = false;

    /**
     * Initialize recovery service - call on app start
     */
    init(): RecoveryInfo {
        // Check if previous session crashed
        const crashFlag = localStorage.getItem(CRASH_FLAG_KEY);
        const recoveryData = localStorage.getItem(STORAGE_KEY);

        // Set crash flag (will be cleared on clean exit)
        localStorage.setItem(CRASH_FLAG_KEY, 'true');

        if (crashFlag === 'true' && recoveryData) {
            try {
                const state: RecoveryState = JSON.parse(recoveryData);
                return {
                    hasRecoveryData: true,
                    timestamp: new Date(state.timestamp),
                    description: `Project with ${state.cards?.length || 0} cards`
                };
            } catch {
                return { hasRecoveryData: false };
            }
        }

        return { hasRecoveryData: false };
    }

    /**
     * Start auto-save interval
     */
    startAutoSave(getState: () => Partial<RecoveryState>): void {
        this.stopAutoSave();
        
        this.autoSaveInterval = window.setInterval(() => {
            this.saveState(getState());
        }, AUTO_SAVE_INTERVAL);

        // Also save immediately
        this.saveState(getState());

        // Setup beforeunload to clear crash flag on clean exit
        window.addEventListener('beforeunload', this.handleCleanExit);
    }

    /**
     * Stop auto-save interval
     */
    stopAutoSave(): void {
        if (this.autoSaveInterval !== null) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        window.removeEventListener('beforeunload', this.handleCleanExit);
    }

    /**
     * Save current state for recovery
     */
    saveState(state: Partial<RecoveryState>): void {
        if (this.isRecovering) return;

        try {
            const recoveryState: RecoveryState = {
                timestamp: Date.now(),
                version: 1,
                cards: state.cards || [],
                timeline: state.timeline || null,
                activeCardId: state.activeCardId || null,
                projectId: state.projectId
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(recoveryState));
        } catch (err) {
            console.warn('Failed to save recovery state:', err);
        }
    }

    /**
     * Get recovery state
     */
    getRecoveryState(): RecoveryState | null {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return null;
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    /**
     * Apply recovered state to store
     */
    recover(applyState: (state: RecoveryState) => void): boolean {
        const state = this.getRecoveryState();
        if (!state) return false;

        this.isRecovering = true;
        try {
            applyState(state);
            return true;
        } catch (err) {
            console.error('Failed to recover state:', err);
            return false;
        } finally {
            this.isRecovering = false;
        }
    }

    /**
     * Clear recovery data (after successful recovery or discard)
     */
    clearRecoveryData(): void {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CRASH_FLAG_KEY);
    }

    /**
     * Mark as clean exit
     */
    private handleCleanExit = (): void => {
        localStorage.removeItem(CRASH_FLAG_KEY);
    };

    /**
     * Force save before potential crash (call from error boundary)
     */
    emergencySave(getState: () => Partial<RecoveryState>): void {
        try {
            this.saveState(getState());
            console.log('Emergency save completed');
        } catch (err) {
            console.error('Emergency save failed:', err);
        }
    }
}

// Singleton instance
export const RecoveryService = new RecoveryServiceClass();
