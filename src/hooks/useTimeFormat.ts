import { useCallback } from 'react';
import { APP_CONFIG } from '../config/constants';

export const useTimeFormat = () => {
    /**
     * Formats milliseconds into MM:SS
     */
    const formatTime = useCallback((ms: number) => {
        if (ms < 0) ms = 0;
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, []);

    /**
     * Formats milliseconds into standard SMPTE-like timecode (HH:MM:SS:FF)
     * @param ms Time in milliseconds
     * @param fps Frames per second (default: project default)
     */
    const formatTimecode = useCallback((ms: number, fps: number = APP_CONFIG.PROJECT.DEFAULT_FPS) => {
        if (ms < 0) ms = 0;
        const totalFrames = Math.floor((ms / 1000) * fps);
        
        const f = totalFrames % fps;
        const totalSeconds = Math.floor(totalFrames / fps);
        const s = totalSeconds % 60;
        const m = Math.floor(totalSeconds / 60) % 60;
        const h = Math.floor(totalSeconds / 3600);

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
    }, []);

    /**
     * Converts timecode string "HH:MM:SS:FF" back to milliseconds
     */
    const parseTimecode = useCallback((timecode: string, fps: number = APP_CONFIG.PROJECT.DEFAULT_FPS) : number => {
         const parts = timecode.split(':').map(Number);
         if (parts.length !== 4) return 0;
         
         const [h, m, s, f] = parts;
         const totalSeconds = (h * 3600) + (m * 60) + s;
         const totalFrames = (totalSeconds * fps) + f;
         
         return (totalFrames / fps) * 1000;
    }, []);

    return {
        formatTime,
        formatTimecode,
        parseTimecode
    };
};
