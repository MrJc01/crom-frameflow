import React, { useEffect, useRef } from 'react';
import { CompositionEngine } from '../engine/CompositionEngine';
import { useAppStore } from '../stores/useAppStore';

export const Viewport: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CompositionEngine | null>(null);
    const toggleStream = useAppStore(state => state.toggleStream);
    const cards = useAppStore(state => state.cards);
    const activeCardId = useAppStore(state => state.activeCardId);

    const activeCard = cards.find(c => c.id === activeCardId) || null;

    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setCard(activeCard);
        }
    }, [activeCard]);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        // Initialize Engine
        const engine = new CompositionEngine(canvasRef.current);
        engineRef.current = engine;
        
        // Initial Card Set (Crucial for first render)
        if (activeCard) {
            engine.setCard(activeCard);
        }

        // Start Engine (which starts camera)
        engine.start()
            .then(() => toggleStream(true))
            .catch(err => console.error("Failed to start engine:", err));

        // Handle resizing
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                // Update canvas internal size to match container
                engine.resize(width, height);
            }
        });
        
        resizeObserver.observe(containerRef.current);

        return () => {
            engine.stop();
            toggleStream(false);
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black rounded-xl">
            <canvas 
                ref={canvasRef} 
                className="block w-full h-full object-cover"
            />
        </div>
    );
};
