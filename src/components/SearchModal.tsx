import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FileVideo, FileAudio, Image, Type, Camera, Sparkles, Command } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { EFFECT_PRESETS } from '../data/presets';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SearchResult {
    id: string;
    type: 'asset' | 'element' | 'effect' | 'action';
    name: string;
    description?: string;
    icon: React.ReactNode;
    onSelect: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    
    const assets = useAppStore(state => state.assets);
    const cards = useAppStore(state => state.cards);
    const activeCardId = useAppStore(state => state.activeCardId);
    const setSelectedElement = useAppStore(state => state.setSelectedElement);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setQuery('');
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const getIconForType = (type: string) => {
        switch (type) {
            case 'video': return <FileVideo className="w-4 h-4 text-blue-400" />;
            case 'audio': return <FileAudio className="w-4 h-4 text-green-400" />;
            case 'image': return <Image className="w-4 h-4 text-purple-400" />;
            case 'text': return <Type className="w-4 h-4 text-yellow-400" />;
            case 'camera': return <Camera className="w-4 h-4 text-red-400" />;
            default: return <Sparkles className="w-4 h-4 text-gray-400" />;
        }
    };

    const results = useMemo((): SearchResult[] => {
        const q = query.toLowerCase().trim();
        if (!q) return [];

        const matches: SearchResult[] = [];

        // Search assets
        assets.forEach(asset => {
            if (asset.name.toLowerCase().includes(q) || asset.type.toLowerCase().includes(q)) {
                matches.push({
                    id: `asset-${asset.id}`,
                    type: 'asset',
                    name: asset.name,
                    description: `Asset • ${asset.type}`,
                    icon: getIconForType(asset.type),
                    onSelect: () => {
                        console.log('Selected asset:', asset.name);
                        onClose();
                    }
                });
            }
        });

        // Search elements in current card
        const activeCard = cards.find(c => c.id === activeCardId);
        if (activeCard) {
            activeCard.elements.forEach(el => {
                const elName = el.type === 'text' ? el.content : `${el.type} element`;
                if (elName.toLowerCase().includes(q) || el.type.toLowerCase().includes(q)) {
                    matches.push({
                        id: `element-${el.id}`,
                        type: 'element',
                        name: elName,
                        description: `Element • ${el.type}`,
                        icon: getIconForType(el.type),
                        onSelect: () => {
                            setSelectedElement(el.id);
                            onClose();
                        }
                    });
                }
            });
        }

        // Search effect presets
        EFFECT_PRESETS.forEach(preset => {
            if (preset.name.toLowerCase().includes(q) || preset.category.toLowerCase().includes(q)) {
                matches.push({
                    id: `effect-${preset.id}`,
                    type: 'effect',
                    name: preset.name,
                    description: `Effect • ${preset.category}`,
                    icon: <Sparkles className="w-4 h-4" style={{ color: preset.thumbnail }} />,
                    onSelect: () => {
                        console.log('Selected effect:', preset.name);
                        onClose();
                    }
                });
            }
        });

        return matches.slice(0, 10); // Limit results
    }, [query, assets, cards, activeCardId, setSelectedElement, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-[500px] overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search assets, elements, effects..."
                        className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
                    />
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Command className="w-3 h-3" />
                        <span>K</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                {/* Results */}
                <div className="max-h-[300px] overflow-y-auto">
                    {query && results.length === 0 && (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                            No results found for "{query}"
                        </div>
                    )}

                    {!query && (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                            Start typing to search...
                        </div>
                    )}

                    {results.map((result, index) => (
                        <button
                            key={result.id}
                            onClick={result.onSelect}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                                index === 0 ? 'bg-white/5' : ''
                            }`}
                        >
                            {result.icon}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">
                                    {result.name}
                                </div>
                                {result.description && (
                                    <div className="text-xs text-gray-500">
                                        {result.description}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                    <span>↑↓ Navigate</span>
                    <span>↵ Select</span>
                    <span>Esc Close</span>
                </div>
            </div>
        </div>
    );
};
