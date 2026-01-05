import React, { useState } from 'react';
import { Sparkles, Palette, Film, X } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { EFFECT_PRESETS, getPresetsByCategory, type EffectPreset } from '../data/presets';
import { Tooltip } from './Tooltip';

interface EffectPresetsProps {
    isOpen: boolean;
    onClose: () => void;
}

export const EffectPresets: React.FC<EffectPresetsProps> = ({ isOpen, onClose }) => {
    const [activeCategory, setActiveCategory] = useState<EffectPreset['category']>('color');
    const selectedElementId = useAppStore(state => state.selectedElementId);
    const activeCardId = useAppStore(state => state.activeCardId);
    const updateElement = useAppStore(state => state.updateElement);

    const applyPreset = (preset: EffectPreset) => {
        if (!selectedElementId || !activeCardId) return;
        updateElement(activeCardId, selectedElementId, { filter: preset.filter });
    };

    if (!isOpen) return null;

    const categories: { id: EffectPreset['category']; label: string; icon: React.ReactNode }[] = [
        { id: 'color', label: 'Color', icon: <Palette className="w-4 h-4" /> },
        { id: 'style', label: 'Style', icon: <Sparkles className="w-4 h-4" /> },
        { id: 'cinematic', label: 'Cinematic', icon: <Film className="w-4 h-4" /> },
    ];

    const presets = getPresetsByCategory(activeCategory);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-[480px] max-h-[600px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        Effect Presets
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 px-4 py-3 border-b border-white/5">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeCategory === cat.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {cat.icon}
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Presets Grid */}
                <div className="p-4 overflow-y-auto max-h-[400px]">
                    {!selectedElementId && (
                        <div className="text-center text-gray-500 py-8">
                            Select an element to apply effects
                        </div>
                    )}
                    
                    {selectedElementId && (
                        <div className="grid grid-cols-4 gap-3">
                            {presets.map(preset => (
                                <Tooltip key={preset.id} content={preset.description || preset.name} position="top">
                                    <button
                                        onClick={() => applyPreset(preset)}
                                        className="group flex flex-col items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-indigo-500/50"
                                    >
                                        <div 
                                            className="w-12 h-12 rounded-lg shadow-inner flex items-center justify-center text-white/30 group-hover:scale-110 transition-transform"
                                            style={{ 
                                                backgroundColor: preset.thumbnail,
                                                filter: preset.filter !== 'none' ? preset.filter : undefined
                                            }}
                                        >
                                            {preset.id === 'none' && <X className="w-5 h-5" />}
                                        </div>
                                        <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                                            {preset.name}
                                        </span>
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
