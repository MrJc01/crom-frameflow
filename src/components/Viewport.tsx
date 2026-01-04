import React, { useEffect, useRef } from 'react';
import { CompositionEngine } from '../engine/CompositionEngine';
import { useAppStore } from '../stores/useAppStore';

export const Viewport: React.FC = () => {
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
        if (!containerRef.current) return;
        
        // 1. Create fresh canvas for Offscreen transfer
        const canvas = document.createElement('canvas');
        canvas.className = "block w-full h-full object-contain";
        containerRef.current.appendChild(canvas);

        // Initialize Engine
        const engine = new CompositionEngine(canvas);
        engineRef.current = engine;
        (window as any).frameflowEngine = engine; // Expose for UI (StudioPanel)
        
        // Initial Card Set (Crucial for first render)
        // We need to access the LATEST activeCard from the scope when effect runs?
        // Actually, activeCard is a dependency of the other effect.
        // But we want to set it initially here too or wait for the other effect?
        // The other effect depends on [activeCard]. It will run after this mount effect? 
        // Or we should merge them?
        // Merging is tricky. Let's explicit set it here using the ref/current value if needed, 
        // but since activeCard is from props/store, it's available in closure.
        const currentCard = useAppStore.getState().cards.find(c => c.id === useAppStore.getState().activeCardId) || null;
        if (currentCard) {
            engine.setCard(currentCard);
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

    return (
        <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black rounded-xl">
           {/* Canvas injected dynamically */}
        </div>
    );
};
