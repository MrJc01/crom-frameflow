import React, { useEffect, useState } from 'react';
import { StorageQuota, type StorageStatus } from '../utils/storageQuota';
import { AlertTriangle, HardDrive } from 'lucide-react';

export const DiskWarning: React.FC = () => {
    const [status, setStatus] = useState<StorageStatus | null>(null);

    useEffect(() => {
        const check = async () => {
            const result = await StorageQuota.checkQuota();
            // Only update if critical to avoid noise
            if (result.isCritical) {
                setStatus(result);
            } else {
                setStatus(null);
            }
        };

        // Check every 30s, or more frequently if needed
        const interval = setInterval(check, 30000);
        check(); // Initial check

        return () => clearInterval(interval);
    }, []);

    if (!status) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-5">
            <div className="bg-red-900/90 border border-red-700 text-white p-4 rounded-lg shadow-2xl backdrop-blur-md flex items-start gap-4 max-w-sm">
                <div className="bg-red-800 p-2 rounded-full shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-200" />
                </div>
                <div>
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                        Low Disk Space
                    </h3>
                    <p className="text-red-100 text-sm mb-3">
                        You are running low on available storage ({StorageQuota.formatBytes(status.usage)} / {StorageQuota.formatBytes(status.quota)} used). 
                        Performance may degrade or data may be lost.
                    </p>
                    <div className="w-full bg-red-950 rounded-full h-2 mb-1">
                        <div 
                            className="bg-red-400 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(status.percentUsed * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-red-300 text-right">
                        {(status.percentUsed * 100).toFixed(1)}% Used
                    </p>
                </div>
            </div>
        </div>
    );
};
