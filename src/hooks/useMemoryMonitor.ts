import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const LOW_MEMORY_THRESHOLD = 1024 * 1024 * 1024; // 1 GB
const CRITICAL_MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500 MB

export const useMemoryMonitor = () => {
    const lastWarningTime = useRef<number>(0);

    useEffect(() => {
        const isTauri = '__TAURI_INTERNALS__' in window;
        if (!isTauri) return;

        let invoke: any;
        import('@tauri-apps/api/core').then(mod => {
            invoke = mod.invoke;
        }).catch(() => {});

        const checkMemory = async () => {
            if (!invoke) return;
            try {
                // sysinfo returns bytes
                const availableBytes = await invoke('get_available_memory') as number;
                
                // Debug log (can remove later)
                // console.log("Available Memory:", (availableBytes / 1024 / 1024).toFixed(0), "MB");

                const now = Date.now();
                // Cooldown: 5 minutes for warning
                if (now - lastWarningTime.current > 5 * 60 * 1000) {
                    if (availableBytes < CRITICAL_MEMORY_THRESHOLD) {
                        toast.error("Critical Memory Warning! Save your work immediately.", { duration: 10000 });
                        lastWarningTime.current = now;
                    } else if (availableBytes < LOW_MEMORY_THRESHOLD) {
                        toast.warning("Low System Memory. Performance may degrade.", { duration: 5000 });
                        lastWarningTime.current = now;
                    }
                }
            } catch (e) {
                console.warn("Memory Check Failed", e);
            }
        };

        const interval = setInterval(checkMemory, 30000); // Check every 30s
        
        // Initial check after 5s
        const timeout = setTimeout(checkMemory, 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);
};
