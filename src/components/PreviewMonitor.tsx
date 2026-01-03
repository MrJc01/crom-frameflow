import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const PreviewMonitor: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVisible, setIsVisible] = React.useState(true);

    // Only show when Timeline is expanded (Edit Mode)
    // We can infer this or pass it as prop. But let's use the Store if we had 'isExpanded' there...
    // Actually StudioPanel has local state 'isExpanded'. 
    // Ideally this component is mounted BY StudioPanel or checks a global store.
    
    // For now, let's assume it's always mounted but we toggle visibility based on usage.
    // To make it truly "Clean Feed", it should just show the stream.

    useEffect(() => {
        const engine = (window as any).frameflowEngine;
        if (engine && videoRef.current) {
            if (typeof engine.getStream === 'function') {
                const stream = engine.getStream();
                videoRef.current.srcObject = stream;
            } else {
                console.warn("CompositionEngine.getStream() is missing. You may need to refresh the page if HMR failed.");
            }
        }
    }, []);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bottom-96 z-40 bg-black flex items-center justify-center overflow-hidden">
            {/* Top Right Controls */}
            <div className="absolute top-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => setIsVisible(false)}
                    className="p-2 bg-black/50 hover:bg-red-500 rounded-full text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            <video 
                ref={videoRef}
                autoPlay 
                muted 
                className="w-full h-full object-contain"
            />
            
            <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 rounded text-xs font-bold text-white/50 pointer-events-none uppercase tracking-widest border border-white/10">
                Program Monitor
            </div>
        </div>
    );
};
