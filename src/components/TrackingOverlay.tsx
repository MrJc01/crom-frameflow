
import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { X, Play, Target, Move } from 'lucide-react';
import { type Rect } from '../services/TrackerService';

export const TrackingOverlay: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [clipId, setClipId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [isTracking, setIsTracking] = useState(false);
    const [status, setStatus] = useState('Idle');
    
    // ROI State
    const [roi, setRoi] = useState<Rect | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const _timeline = useAppStore(state => state.timeline);
    
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOpen = (e: CustomEvent) => {
            setClipId(e.detail.clipId);
            setIsOpen(true);
            setIsTracking(false);
            setProgress(0);
            setStatus('Select Object to Track');
            setRoi(null);
            
            // Pause engine
             const engine = (window as any).frameflowEngine;
             if (engine) engine.pause();
        };

        const handleMessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
             if (type === 'TRACK_START') {
                 setStatus('Tracking...');
             } else if (type === 'TRACK_PROGRESS') {
                 setProgress(payload);
             } else if (type === 'TRACK_COMPLETE') {
                 setStatus('Complete!');
                 setIsTracking(false);
                 console.log("Tracking Data:", payload);
                 // Save to Clip? Or just alert for now.
                 // Ideally, we copy this data to clipboard or offer to apply to element.
                 
                 // Let's prompt user to apply to a new Text Element for testing.
                 if (confirm("Tracking Complete! Create Debug Marker?")) {
                     const keyframes = payload;
                     const state = useAppStore.getState();
                     const clip = state.timeline.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
                     
                     if (clip) {
                         // Add a new Text Element to scene that follows this path
                         state.addClip(state.timeline.tracks.find(t=>t.type==='video')?.id || 'video-1', {
                             id: crypto.randomUUID(),
                             assetId: 'text-asset', // Hack
                             name: 'Tracked Marker',
                             start: clip.start,
                             duration: clip.duration,
                             offset: 0,
                             // We need to attach animations to the Element not the Clip really, 
                             // but our store maps clips to elements roughly. 
                             // Let's just log it for MVP verification.
                         });
                    }
                 }
                 
                 setIsOpen(false);
             } else if (type === 'TRACK_ERROR') {
                 setStatus('Error');
                 setIsTracking(false);
                 alert("Tracking Failed: " + payload);
             }
        };

        window.addEventListener('open-motion-tracking', handleOpen as any);
        (window as any).frameflowEngine?.worker?.addEventListener('message', handleMessage);
        
        return () => {
            window.removeEventListener('open-motion-tracking', handleOpen as any);
             (window as any).frameflowEngine?.worker?.removeEventListener('message', handleMessage);
        };
    }, [clipId]);

    // Selection Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isTracking) return;
        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setStartPos({ x, y });
        setIsSelecting(true);
        setRoi({ x, y, width: 0, height: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !roi || isTracking) return;
        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const w = x - startPos.x;
        const h = y - startPos.y;
        
        setRoi({
            x: w > 0 ? startPos.x : x,
            y: h > 0 ? startPos.y : y,
            width: Math.abs(w),
            height: Math.abs(h)
        });
    };

    const handleMouseUp = () => {
        setIsSelecting(false);
    };

    const startTracking = () => {
        if (!roi || !clipId) return;
        
        // Convert UI Coords to Canvas Coords?
        // Detailed mapping needed if canvas is scaled. 
        // For now assuming 1:1 or "close enough" for test, OR we must read scale from StudioPanel/Engine.
        // Hack: We'll assume Full Canvas for now or pass relative coords (0-1).
        // Let's pass raw pixels assuming the overlay matches the canvas size.
        // Actually, the overlay is likely ON TOP of the canvas.
        
        // We need to map ROI to the actual rendering resolution.
        // Let's grab the actual canvas from the DOM to check size?
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        
        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        const scaleX = canvas.width / rect.width; // 1920 / clientWidth
        const scaleY = canvas.height / rect.height; // 1080 / clientHeight
        
        const scaledRoi: Rect = {
            x: roi.x * scaleX,
            y: roi.y * scaleY,
            width: roi.width * scaleX,
            height: roi.height * scaleY
        };

        setIsTracking(true);
        setStatus('Initializing...');
        
        const state = useAppStore.getState();
        const clip = state.timeline.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
        if (!clip) return;

        (window as any).frameflowEngine.worker.postMessage({
            type: 'TRACK_MOTION',
            payload: {
                clipId,
                roi: scaledRoi,
                start: clip.start,
                duration: clip.duration, // Track whole clip for now
                fps: 30
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80">
            <div className="relative bg-[#1a1a1a] border border-white/10 rounded-lg p-4 w-[90vw] h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium flex items-center gap-2">
                        <Target className="w-4 h-4 text-orange-400" />
                        Motion Tracking
                    </h3>
                    <button onClick={() => setIsOpen(false)}><X className="w-5 h-5 text-white/50" /></button>
                </div>
                
                {/* Overlay Area - Should Match Aspect Ratio of Project roughly */}
                <div 
                    className="flex-1 bg-black relative overflow-hidden cursor-crosshair border border-white/20" 
                    ref={overlayRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                     {/* Transparent "Hole" or just showing canvas underneath? 
                         If we use `inset-0` fixed, we cover everything.
                         We should rely on the fact that the canvas is BEHIND this modal? 
                         No, Modal has black bg.
                         We need to see the video. 
                         Ideally this overlay is *on top* of the StudioPanel canvas, not a modal.
                     */}
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <span className="text-white/20 select-none">
                             Video Preview Placeholder (Ideally transparent to see canvas)
                             <br/>
                             For MVP: Please ensure this modal is transparent or we move the canvas here?
                         </span>
                     </div>
                     
                     {/* ROI Box */}
                     {roi && (
                         <div 
                            className="absolute border-2 border-orange-500 bg-orange-500/20"
                            style={{
                                left: roi.x,
                                top: roi.y,
                                width: roi.width,
                                height: roi.height
                            }}
                         />
                     )}
                </div>
                
                {/* Controls */}
                <div className="mt-4 flex items-center gap-4">
                     <div className="text-sm text-white/70">
                         Status: <span className="text-white">{status}</span>
                         {progress > 0 && ` (${Math.round(progress * 100)}%)`}
                     </div>
                     
                     <div className="flex-1" />
                     
                     <button 
                        onClick={startTracking}
                        disabled={!roi || isTracking}
                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
                     >
                         <Play className="w-4 h-4" /> Start Tracking
                     </button>
                </div>
            </div>
            
            {/* Style override to make modal transparent-ish if we want to see underlying canvas? */}
            {/* But standard modal z-index might hide canvas. 
                For MVP, let's just make the modal content background transparent?
            */}
            <style>{`
                .bg-black\\/80 { background: rgba(0,0,0,0.5); }
            `}</style>
        </div>
    );
};
