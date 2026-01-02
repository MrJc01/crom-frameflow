import React from 'react';
import { useAppStore, type SceneElement } from '../stores/useAppStore';
import { ArrowUp, ArrowDown, Trash2, Layers as LayersIcon } from 'lucide-react';

export const PropertyInspector: React.FC = () => {
    const activeCardId = useAppStore(state => state.activeCardId);
    const cards = useAppStore(state => state.cards);
    const selectedElementId = useAppStore(state => state.selectedElementId);
    const updateCardElements = useAppStore(state => state.updateCardElements);

    const activeCard = cards.find(c => c.id === activeCardId);
    const selectedElement = activeCard?.elements.find(el => el.id === selectedElementId);

    if (!selectedElement || !activeCard) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
                <LayersIcon className="w-8 h-8 mb-2 opacity-20" />
                <p>Select an element to edit</p>
            </div>
        );
    }

    const handleChange = (key: keyof SceneElement, value: string | number) => {
        const newElements = activeCard.elements.map(el => 
            el.id === selectedElement.id ? { ...el, [key]: value } : el
        );
        updateCardElements(activeCard.id, newElements);
    };

    const handleDelete = () => {
        const newElements = activeCard.elements.filter(el => el.id !== selectedElement.id);
        updateCardElements(activeCard.id, newElements);
    };

    const handleLayer = (direction: 'up' | 'down') => {
        const newElements = activeCard.elements.map(el => 
            el.id === selectedElement.id ? { ...el, zIndex: el.zIndex + (direction === 'up' ? 1 : -1) } : el
        );
        updateCardElements(activeCard.id, newElements);
    };

    return (
        <div className="p-4 space-y-6 text-sm text-gray-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-semibold text-white uppercase tracking-wider text-xs">Inspector</h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                    {selectedElement.type.toUpperCase()}
                </span>
            </div>

            {/* Transform */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Transform</h4>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">X Position</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.x)} 
                            onChange={(e) => handleChange('x', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Y Position</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.y)} 
                            onChange={(e) => handleChange('y', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Width</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.width)} 
                            onChange={(e) => handleChange('width', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Height</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.height)} 
                            onChange={(e) => handleChange('height', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                </div>
            </div>

            {/* Layering & Actions */}
            
            {/* Text Properties (Conditional) */}
            {selectedElement.type === 'text' && (
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">Typography</h4>
                    <div className="space-y-2">
                        <div>
                            <label className="text-[10px] text-gray-400 block mb-1">Content</label>
                            <textarea 
                                value={selectedElement.content} 
                                onChange={(e) => handleChange('content', e.target.value as any)}
                                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-xs resize-none h-16"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-gray-400 block mb-1">Size (px)</label>
                                <input 
                                    type="number" 
                                    value={selectedElement.fontSize || 30} 
                                    onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block mb-1">Color</label>
                                <input 
                                    type="color" 
                                    value={selectedElement.color || '#ffffff'} 
                                    onChange={(e) => handleChange('color', e.target.value as any)}
                                    className="w-full h-7 bg-transparent border border-white/10 rounded cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* General Style (Opacity) */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Appearance</h4>
                <div>
                     <label className="text-[10px] text-gray-400 block mb-1">Opacity</label>
                     <input 
                        type="range" 
                        min="0" max="1" step="0.1"
                        value={selectedElement.opacity ?? 1} 
                        onChange={(e) => handleChange('opacity', Number(e.target.value))}
                        className="w-full accent-indigo-500"
                     />
                </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => handleLayer('up')} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 p-2 rounded transition-colors">
                        <ArrowUp className="w-4 h-4" /> <span className="text-xs">Bring Fwd</span>
                     </button>
                     <button onClick={() => handleLayer('down')} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 p-2 rounded transition-colors">
                        <ArrowDown className="w-4 h-4" /> <span className="text-xs">Send Back</span>
                     </button>
                </div>
                <button 
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/50 p-2 rounded transition-colors mt-2"
                >
                    <Trash2 className="w-4 h-4" /> Delete Element
                </button>
            </div>
        </div>
    );
};
