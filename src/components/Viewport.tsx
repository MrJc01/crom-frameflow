import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CompositionEngine } from '../engine/CompositionEngine';
import { useAppStore } from '../stores/useAppStore';
import { TransformGizmo } from './TransformGizmo';

export const Viewport: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CompositionEngine | null>(null);
    const toggleStream = useAppStore(state => state.toggleStream);
    
    // Optimized Selectors
    const activeCardId = useAppStore(state => state.activeCardId);
    const selectedElementId = useAppStore(state => state.selectedElementId);
    
    // Only subscribe to the active card
    const activeCard = useAppStore(state => state.cards.find(c => c.id === state.activeCardId));
    
    // Only subscribe to the selected element within the active card
    const selectedElement = useAppStore(state => {
        const card = state.cards.find(c => c.id === state.activeCardId);
        return card?.elements.find(e => e.id === state.selectedElementId);
    });

    const updateElement = useAppStore(state => state.updateElement);
    
    const [viewportScale, setViewportScale] = useState(1);
    const [transformStart, setTransformStart] = useState<{x: number, y: number, width: number, height: number, rotation: number} | null>(null);

    const previewFps = useAppStore(state => state.settings.previewFps);

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setCard(activeCard);
        }
    }, [activeCard]);

    useEffect(() => {
        if (engineRef.current && previewFps) {
            engineRef.current.setFps(previewFps);
        }
    }, [previewFps]);

    useEffect(() => {
        if (!containerRef.current) return;
        
        // 1. Create fresh canvas for Offscreen transfer
        const canvas = document.createElement('canvas');
        canvas.className = "block w-full h-full object-contain";
        containerRef.current.appendChild(canvas);

        // Initialize Engine
        const engine = new CompositionEngine(canvas);
        engineRef.current = engine;
        (window as any).frameflowEngine = engine;
        
        const currentCard = useAppStore.getState().cards.find(c => c.id === useAppStore.getState().activeCardId) || null;
        if (currentCard) {
            engine.setCard(currentCard);
        }

        // Start Engine
        engine.start()
            .then(() => toggleStream(true))
            .catch(err => console.error("Failed to start engine:", err));

        // Handle resizing - track scale
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                engine.resize(width, height);
                // Calculate scale (assuming 1920x1080 base)
                const scaleX = width / 1920;
                const scaleY = height / 1080;
                setViewportScale(Math.min(scaleX, scaleY));
            }
        });
        
        resizeObserver.observe(containerRef.current);

        return () => {
            console.log("Cleaning up Viewport Engine");
            engine.stop();
            toggleStream(false);
            resizeObserver.disconnect();
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            engineRef.current = null;
        };
    }, []);

    // Gizmo handlers
    const handleMove = useCallback((dx: number, dy: number) => {
        if (!selectedElement || !activeCardId || !transformStart) return;
        updateElement(activeCardId, selectedElement.id, {
            x: transformStart.x + dx,
            y: transformStart.y + dy
        });
    }, [selectedElement, activeCardId, updateElement, transformStart]);

    const handleResize = useCallback((newWidth: number, newHeight: number, _anchor: string) => {
        if (!selectedElement || !activeCardId) return;
        updateElement(activeCardId, selectedElement.id, {
            width: Math.max(10, newWidth),
            height: Math.max(10, newHeight)
        });
    }, [selectedElement, activeCardId, updateElement]);

    const handleRotate = useCallback((newRotation: number) => {
        if (!selectedElement || !activeCardId) return;
        updateElement(activeCardId, selectedElement.id, { rotation: newRotation });
    }, [selectedElement, activeCardId, updateElement]);

    const handleTransformEnd = useCallback(() => {
        // Re-sync start position for next drag
        if (selectedElement) {
            setTransformStart({
                x: selectedElement.x,
                y: selectedElement.y,
                width: selectedElement.width,
                height: selectedElement.height,
                rotation: selectedElement.rotation || 0
            });
        }
    }, [selectedElement]);

    // Track transform start when element changes
    useEffect(() => {
        if (selectedElement) {
            setTransformStart({
                x: selectedElement.x,
                y: selectedElement.y,
                width: selectedElement.width,
                height: selectedElement.height,
                rotation: selectedElement.rotation || 0
            });
        } else {
            setTransformStart(null);
        }
    }, [selectedElementId]);

    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black rounded-xl">
           {/* Canvas injected dynamically */}
           
           {/* Transform Gizmo Overlay */}
           {selectedElement && transformStart && (
               <TransformGizmo
                   x={selectedElement.x}
                   y={selectedElement.y}
                   width={selectedElement.width}
                   height={selectedElement.height}
                   rotation={selectedElement.rotation || 0}
                   scale={viewportScale}
                   onMove={handleMove}
                   onResize={handleResize}
                   onRotate={handleRotate}
                   onTransformEnd={handleTransformEnd}
               />
           )}
        </div>
    );
};
