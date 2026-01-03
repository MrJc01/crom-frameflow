import React, { useEffect, useState } from 'react';
import { useAppStore, type SceneElement } from '../stores/useAppStore';
import { db } from '../db/FrameFlowDB';
import { Trash2, Upload } from 'lucide-react';

export const AssetLibrary: React.FC = () => {
    const cards = useAppStore(state => state.cards);
    const activeCardId = useAppStore(state => state.activeCardId);
    const updateCardElements = useAppStore(state => state.updateCardElements);
    
    const activeCard = cards.find(c => c.id === activeCardId);

    const [assets, setAssets] = useState<any[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const loadAssets = async () => {
        const dbAssets = await db.getAllAssets();
        // Create Object URLs for display
        const displayAssets = dbAssets.map(a => ({
            ...a,
            url: URL.createObjectURL(a.blob)
        }));
        setAssets(displayAssets);
    };

    useEffect(() => {
        loadAssets();
        // Cleanup URLs on unmount
        return () => {
            assets.forEach(a => URL.revokeObjectURL(a.url));
        };
    }, []);

    const handleFileDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    await db.addAsset(file);
                }
            }
            await loadAssets(); // Refresh
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await db.deleteAsset(id);
        await loadAssets();
    };

    const addToScene = (asset: any) => {
        if (!activeCard) return;
        
        // Quick dimension check (async for video/img really, but we'll guess)
        // Ideally we load the Image/Video object to get dimensions. 
        // For now, default to 400px width.
        
        const newEl: SceneElement = {
            id: `asset-${Date.now()}`,
            type: asset.type, 
            content: asset.url, 
            assetId: asset.id, // Persist link to DB
            x: 100, y: 100, 
            width: 400, height: 300, 
            rotation: 0, zIndex: 15,
        };

        // If it's an image, let's try to get natural dims?
        if (asset.type === 'image') {
             const img = new Image();
             img.src = asset.url;
             img.onload = () => {
                  newEl.width = 400;
                  newEl.height = (400 / img.width) * img.height;
                  updateCardElements(activeCard.id, [...activeCard.elements, newEl]);
             };
        } else {
             updateCardElements(activeCard.id, [...activeCard.elements, newEl]);
        }
    };

    return (
        <div 
            className={`flex flex-col h-full bg-[#0d0d0d]/50 transition-colors ${isDragging ? 'bg-indigo-900/20 ring-2 ring-indigo-500' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
        >
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assets Library</h3>
                <Upload className="w-4 h-4 text-gray-500" />
            </div>
            
            <div className="p-2 grid grid-cols-2 gap-2 overflow-y-auto flex-1 content-start">
                {assets.length === 0 && (
                     <div className="col-span-2 text-center py-8 text-gray-600 text-xs">
                         Drop files here
                     </div>
                )}
                
                {assets.map((asset) => (
                    <div 
                        key={asset.id}
                        onClick={() => addToScene(asset)}
                        className="aspect-video bg-white/5 rounded overflow-hidden cursor-pointer hover:ring-2 ring-indigo-500 transition-all group relative"
                    >
                        {asset.type === 'image' ? (
                            <img src={asset.url} className="w-full h-full object-cover" alt={asset.name} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-black">
                                <span className="text-xs text-gray-500">Video</span>
                            </div>
                        )}
                        
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate text-[10px] text-gray-300 flex justify-between items-center group-hover:opacity-100 opacity-0 transition-opacity">
                            <span className="truncate flex-1">{asset.name}</span>
                            <button 
                                onClick={(e) => handleDelete(e, asset.id)}
                                className="text-gray-400 hover:text-red-400"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-2 border-t border-white/10 bg-black/20 text-[10px] text-gray-500 text-center">
                Drag files to import • IndexedDB
            </div>
        </div>
    );
};
