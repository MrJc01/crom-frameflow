import React, { memo } from 'react';

interface TimelineRulerProps {
    duration: number;
    zoom: number;
    onSeek: (time: number) => void;
}

export const TimelineRuler = memo(({ duration, zoom, onSeek }: TimelineRulerProps) => {
    // console.log("[TimelineRuler] Render"); // Debug to verify memoization
    
    // Safety check for Zoom to avoid Infinite Loop / Memory Crash
    const safeZoom = Math.max(zoom, 10); 
    const segments = Math.ceil(duration / 1000);

    return (
        <div 
            className="h-6 border-b border-white/10 bg-[#111] absolute top-0 left-0 right-0 z-20 flex cursor-pointer hover:bg-white/5"
            onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                // e.clientX - rect.left IS the x position within the SCROLLABLE container 
                // IF the ruler width matches the container width. 
                // Since this specific div is laid out with flex inside the scroll area, rect.left moves with scroll.
                // Wait.
                // If container scrolls, rect.left shifts off screen. e.clientX is viewport relative.
                // e.clientX - rect.left gives coordinate RELATIVE to the start of this specific element (the ruler).
                // Since the ruler spans the full width of the timeline content, 0 is 0s.
                
                const x = e.clientX - rect.left;
                const newTime = (x / safeZoom) * 1000;
                onSeek(newTime);
            }}
        >
            {Array.from({ length: segments }).map((_, i) => (
                <div 
                    key={i} 
                    className="border-l border-white/20 h-full text-[10px] text-gray-500 pl-1 select-none"
                    style={{ width: `${safeZoom}px` }}
                >
                    {i}s
                </div>
            ))}
        </div>
    );
});
