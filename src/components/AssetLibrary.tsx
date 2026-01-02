import React from 'react';
import { useAppStore } from '../stores/useAppStore';

const MOCK_ASSETS = [
    { type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200', name: 'Abstract Blue', width: 600, height: 400 },
    { type: 'image', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200', name: 'Neon City', width: 600, height: 400 },
    { type: 'image', url: 'https://plus.unsplash.com/premium_photo-1673697239981-389164b7b87f?q=80&w=200', name: 'Paper Texture', width: 500, height: 500 },
];

export const AssetLibrary: React.FC = () => {
    const cards = useAppStore(state => state.cards);
    const activeCardId = useAppStore(state => state.activeCardId);
    const updateCardElements = useAppStore(state => state.updateCardElements);
    
    const activeCard = cards.find(c => c.id === activeCardId);

    const addAsset = (asset: any) => {
        if (!activeCard) return;
        const newEl = {
            id: `img-${Date.now()}`,
            type: 'image' as const,
            content: asset.url,
            // Replace thumbnails with full res logic if needed
            x: 100, y: 100, 
            width: 400, height: (400 / asset.width) * asset.height,
            rotation: 0, zIndex: 15
        };
        updateCardElements(activeCard.id, [...activeCard.elements, newEl]);
    };

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d]/50">
            <div className="p-4 border-b border-white/10">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assets Library</h3>
            </div>
            
            <div className="p-2 grid grid-cols-2 gap-2 overflow-y-auto max-h-[300px]">
                {MOCK_ASSETS.map((asset, i) => (
                    <div 
                        key={i}
                        onClick={() => addAsset(asset)}
                        className="aspect-video bg-white/5 rounded overflow-hidden cursor-pointer hover:ring-2 ring-indigo-500 transition-all group relative"
                    >
                        <img src={asset.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={asset.name} />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate text-[10px] text-gray-300">
                            {asset.name}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-4 border-t border-white/10 mt-auto">
                 <p className="text-[10px] text-gray-600 text-center">
                    Drag and drop to canvas coming soon. <br/> Click to add for now.
                 </p>
            </div>
        </div>
    );
};
