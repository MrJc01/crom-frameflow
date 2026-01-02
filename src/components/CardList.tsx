import React from 'react';
import { useAppStore } from '../stores/useAppStore';

export const CardList: React.FC = () => {
    const cards = useAppStore(state => state.cards);
    const activeCardId = useAppStore(state => state.activeCardId);
    const setActiveCard = useAppStore(state => state.setActiveCard);

    if (cards.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500 text-sm">
                No cards loaded. <br/> Import a PPTX to begin.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-full scrollbar-thin scrollbar-thumb-white/10">
            {cards.map(card => (
                <div 
                    key={card.id}
                    onClick={() => setActiveCard(card.id)}
                    className={`
                        relative group
                        flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all
                        ${activeCardId === card.id ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 hover:bg-white/10 border-transparent'}
                        border
                    `}
                >
                    {/* Thumbnail */}
                    <div className="w-16 h-10 bg-black rounded overflow-hidden flex-shrink-0 relative">
                        {card.thumbnailUrl ? (
                            <img src={card.thumbnailUrl} className="w-full h-full object-cover" alt="Card" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs text-gray-600">
                                Empty
                            </div>
                        )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${activeCardId === card.id ? 'text-indigo-200' : 'text-gray-300'}`}>
                            {card.title || 'Untitled Scene'}
                        </p>
                        <p className="text-[10px] text-gray-500 uppercase">{card.elements.length} elements</p>
                    </div>

                    {/* Active Indicator */}
                    {activeCardId === card.id && (
                        <div className="absolute right-2 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    )}
                </div>
            ))}
        </div>
    );
};
