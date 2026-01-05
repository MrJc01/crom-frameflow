import React from 'react';
import { useAppStore } from '../stores/useAppStore';

interface RenderProgressProps {
    width: number; // Total timeline width in pixels
    duration: number; // Total timeline duration in seconds
    zoom: number;
}

export const RenderProgress: React.FC<RenderProgressProps> = ({ width, duration, zoom }) => {
    // Get render cache state from store
    const renderCache = useAppStore(state => state.renderCache);
    
    if (renderCache.cachedRanges.length === 0 && !renderCache.isRendering) {
        return null;
    }

    const timeToPixel = (time: number) => (time / duration) * width * zoom;

    return (
        <div className="absolute top-0 left-0 right-0 h-1 pointer-events-none">
            {/* Background track */}
            <div className="absolute inset-0 bg-gray-800/50" />
            
            {/* Cached ranges */}
            {renderCache.cachedRanges.map((range: { start: number; end: number }, index: number) => (
                <div
                    key={index}
                    className="absolute top-0 h-full bg-green-500/60"
                    style={{
                        left: timeToPixel(range.start),
                        width: timeToPixel(range.end - range.start)
                    }}
                />
            ))}
            
            {/* Active render indicator */}
            {renderCache.isRendering && (
                <div 
                    className="absolute top-0 h-full w-2 bg-yellow-400 animate-pulse"
                    style={{ left: timeToPixel(renderCache.currentTime || 0) }}
                />
            )}
        </div>
    );
};

// Compact version for small spaces
export const RenderProgressBar: React.FC<{ className?: string }> = ({ className }) => {
    const renderCache = useAppStore(state => state.renderCache);
    
    return (
        <div className={`flex items-center gap-2 ${className || ''}`}>
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-300 ${
                        renderCache.isRendering ? 'bg-yellow-400' : 'bg-green-500'
                    }`}
                    style={{ width: `${(renderCache.progress || 0) * 100}%` }}
                />
            </div>
            {renderCache.isRendering && (
                <span className="text-[10px] text-yellow-400 animate-pulse">
                    Rendering...
                </span>
            )}
        </div>
    );
};
