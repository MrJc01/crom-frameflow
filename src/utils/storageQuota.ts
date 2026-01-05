/**
 * Storage Quota Utility
 * Monitors available storage and simulates disk full scenarios
 */

export interface StorageStatus {
    usage: number; // bytes
    quota: number; // bytes
    percentUsed: number;
    isCritical: boolean; // > 90% used
}

let simulatedFullDisk = false;

export const StorageQuota = {
    /**
     * Check current storage usage and quota
     */
    checkQuota: async (): Promise<StorageStatus> => {
        if (simulatedFullDisk) {
            return {
                usage: 950000000,
                quota: 1000000000,
                percentUsed: 0.95,
                isCritical: true
            };
        }

        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const { usage, quota } = await navigator.storage.estimate();
                const u = usage || 0;
                const q = quota || 1024 * 1024 * 1024; // Default 1GB if unknown
                
                const percentUsed = u / q;
                
                return {
                    usage: u,
                    quota: q,
                    percentUsed,
                    isCritical: percentUsed > 0.9
                };
            } catch (err) {
                console.warn('Storage estimate failed:', err);
            }
        }
        
        // Fallback
        return {
            usage: 0,
            quota: 0,
            percentUsed: 0,
            isCritical: false
        };
    },

    /**
     * Enable/Disable simulation mode
     */
    simulateFullDisk: (enable: boolean) => {
        simulatedFullDisk = enable;
        console.log(`[StorageQuota] Simulation ${enable ? 'ENABLED' : 'DISABLED'}`);
    },

    /**
     * Format bytes to human readable string
     */
    formatBytes: (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
};

// Expose for console testing
(window as any).StorageQuota = StorageQuota;
