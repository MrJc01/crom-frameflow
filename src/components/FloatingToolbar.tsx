import React from 'react';
import { Type, Camera, Image, Square, MousePointer2 } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Tooltip } from './Tooltip';

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
        window.dispatchEvent(new CustomEvent('trigger-image-upload'));
    };

    const handleAddShape = () => {
         if (!activeCard) return;
         console.log("Add Shape clicked - Coming Soon");
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl z-50">
            <Tooltip content="Select Tool" position="top">
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                    <MousePointer2 className="w-5 h-5" />
                </button>
            </Tooltip>
            <div className="w-px h-6 bg-white/10 mx-1" />
            
            <Tooltip content="Add Text" position="top">
                <button 
                    onClick={handleAddText}
                    disabled={!activeCard}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Type className="w-5 h-5" />
                </button>
            </Tooltip>
            
            <Tooltip content="Add Camera" position="top">
                <button 
                    onClick={handleAddCamera}
                    disabled={!activeCard}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Camera className="w-5 h-5" />
                </button>
            </Tooltip>
            
            <Tooltip content="Add Image" position="top">
                <button 
                    onClick={handleAddImage}
                    disabled={!activeCard}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Image className="w-5 h-5" />
                </button>
            </Tooltip>

            <Tooltip content="Add Shape" position="top">
                <button 
                    onClick={handleAddShape}
                    disabled={!activeCard}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Square className="w-5 h-5" />
                </button>
            </Tooltip>
        </div>
    );
};
