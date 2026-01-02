import React from 'react';
import { Type, Camera, Image, Square, MousePointer2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

export const FloatingToolbar: React.FC = () => {
    const activeCardId = useAppStore(state => state.activeCardId);
    const updateCardElements = useAppStore(state => state.updateCardElements);
    const cards = useAppStore(state => state.cards);
    
    // Quick access to active card logic
    const activeCard = cards.find(c => c.id === activeCardId);

    const handleAddCamera = () => {
        if (!activeCard) return;
        const newElement = {
            id: `cam-${Date.now()}`,
            type: 'camera' as const,
            content: 'camera',
            x: 200, y: 200, width: 480, height: 270,
            rotation: 0, zIndex: 10
        };
        updateCardElements(activeCard.id, [...activeCard.elements, newElement]);
    };

    const handleAddText = () => {
        if (!activeCard) return;
        const newElement = {
            id: `txt-${Date.now()}`,
            type: 'text' as const,
            content: 'New Text',
            x: 200, y: 300, width: 300, height: 100,
            rotation: 0, zIndex: 20,
            fontSize: 40, color: '#ffffff'
        };
        updateCardElements(activeCard.id, [...activeCard.elements, newElement]);
    };

    const handleAddImage = () => {
        // Trigger the global image input - this is a bit hacky, 
        // ideally we move that ref to store or context, but for now we'll dispatch an event or just use the same logic if we pass the ref?
        // Let's assume we can trigger the input in App.tsx via a custom event or store flag.
        // For simplicity: We will dispatch a custom event that App.tsx listens to.
        window.dispatchEvent(new CustomEvent('trigger-image-upload'));
    };

    const handleAddShape = () => {
         if (!activeCard) return;
         // Placeholder for shape logic (using image/box for now)
         console.log("Add Shape clicked - Coming Soon");
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl z-50">
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white tooltip" title="Select">
                <MousePointer2 className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            
            <button 
                onClick={handleAddText}
                disabled={!activeCard}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed" 
                title="Add Text"
            >
                <Type className="w-5 h-5" />
            </button>
            
            <button 
                onClick={handleAddCamera}
                disabled={!activeCard}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed" 
                title="Add Camera"
            >
                <Camera className="w-5 h-5" />
            </button>
            
            <button 
                onClick={handleAddImage}
                disabled={!activeCard}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed" 
                title="Add Image"
            >
                <Image className="w-5 h-5" />
            </button>

            <button 
                onClick={handleAddShape}
                disabled={!activeCard}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed" 
                title="Add Shape"
            >
                <Square className="w-5 h-5" />
            </button>
        </div>
    );
};
