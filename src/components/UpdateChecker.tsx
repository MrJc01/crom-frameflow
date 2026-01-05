import React, { useEffect, useState } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';

interface UpdateInfo {
    version: string;
    notes: string;
    date: string;
}

export const UpdateChecker: React.FC = () => {
    const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check for updates on app start (after a short delay)
        const timer = setTimeout(() => {
            checkForUpdates();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const checkForUpdates = async () => {
        if (isChecking) return;
        
        setIsChecking(true);
        
        try {
            // Dynamic import to avoid bundling issues in non-Tauri environments
            const { check } = await import('@tauri-apps/plugin-updater');
            const update = await check();
            
            if (update) {
                setUpdateAvailable({
                    version: update.version,
                    notes: update.body || 'Bug fixes and improvements',
                    date: update.date || new Date().toISOString()
                });
            }
        } catch (error) {
            console.log('Update check skipped:', error);
            // Silently fail - this is expected in dev mode or web builds
        } finally {
            setIsChecking(false);
        }
    };

    const installUpdate = async () => {
        if (!updateAvailable || isDownloading) return;
        
        setIsDownloading(true);
        
        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const { relaunch } = await import('@tauri-apps/plugin-process');
            
            const update = await check();
            
            if (update) {
                await update.downloadAndInstall((event) => {
                    if (event.event === 'Progress') {
                        const progress = (event.data.chunkLength / event.data.contentLength) * 100;
                        setDownloadProgress(progress);
                    }
                });
                
                // Relaunch the app to apply the update
                await relaunch();
            }
        } catch (error) {
            console.error('Update failed:', error);
            alert('Failed to install update. Please try again later.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (!updateAvailable || dismissed) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[200] animate-in slide-in-from-bottom-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-2xl p-4 max-w-sm border border-white/20">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Download className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">
                                Update Available
                            </h3>
                            <p className="text-sm text-white/80">
                                Version {updateAvailable.version}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-white/60 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <p className="text-sm text-white/70 mt-3 line-clamp-2">
                    {updateAvailable.notes}
                </p>
                
                {isDownloading && (
                    <div className="mt-3">
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-white transition-all duration-300"
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                            Downloading... {Math.round(downloadProgress)}%
                        </p>
                    </div>
                )}
                
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={installUpdate}
                        disabled={isDownloading}
                        className="flex-1 px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isDownloading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Install Update
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setDismissed(true)}
                        className="px-4 py-2 text-white/80 hover:text-white transition-colors"
                    >
                        Later
                    </button>
                </div>
            </div>
        </div>
    );
};
