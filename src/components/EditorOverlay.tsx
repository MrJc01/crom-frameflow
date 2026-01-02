import React, { useState } from 'react';
import { useAppStore, type SceneElement } from '../stores/useAppStore';

export const EditorOverlay: React.FC = () => {
    const activeCardId = useAppStore(state => state.activeCardId);
    const cards = useAppStore(state => state.cards);
    const updateCardElements = useAppStore(state => state.updateCardElements);
    const selectedElementId = useAppStore(state => state.selectedElementId);
    const setSelectedElement = useAppStore(state => state.setSelectedElement);
    
    const activeCard = cards.find(c => c.id === activeCardId);
    
    // Interaction State
    const [interactionMode, setInteractionMode] = useState<'move' | 'resize'>('move');
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
    const [initialElementState, setInitialElementState] = useState<SceneElement | null>(null);

    if (!activeCard) return null;

    const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
        e.stopPropagation();
        setSelectedElement(elementId);
        setInteractionMode('move');
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleResizeStart = (e: React.MouseEvent, element: SceneElement, handle: string) => {
        e.stopPropagation();
        setSelectedElement(element.id); // Ensure selected
        setInteractionMode('resize');
        setResizeHandle(handle);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialElementState({...element});
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedElementId || !dragStart || !activeCard) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        const newElements = activeCard.elements.map(el => {
            if (el.id === selectedElementId) {
                if (interactionMode === 'move') {
                    return {
                        ...el,
                        x: el.x + deltaX,
                        y: el.y + deltaY
                    };
                } else if (interactionMode === 'resize' && initialElementState) {
                    // Basic scaling logic based on handle
                    // This is simplified and doesn't account for rotation yet
                    const s = initialElementState;
                    let newEl = { ...el };

                    switch (resizeHandle) {
                        case 'br': // Bottom Right
                             newEl.width = Math.max(10, s.width + deltaX);
                             newEl.height = Math.max(10, s.height + deltaY);
                             break;
                        case 'bl': // Bottom Left
                             newEl.x = s.x + deltaX;
                             newEl.width = Math.max(10, s.width - deltaX);
                             newEl.height = Math.max(10, s.height + deltaY);
                             break;
                        case 'tr': // Top Right
                             newEl.y = s.y + deltaY;
                             newEl.width = Math.max(10, s.width + deltaX);
                             newEl.height = Math.max(10, s.height - deltaY);
                             break;
                        case 'tl': // Top Left
                             newEl.x = s.x + deltaX;
                             newEl.y = s.y + deltaY;
                             newEl.width = Math.max(10, s.width - deltaX);
                             newEl.height = Math.max(10, s.height - deltaY);
                             break;
                    }
                    return newEl;
                }
            }
            return el;
        });

        updateCardElements(activeCard.id, newElements);
        
        // For 'move', we reset dragStart to avoid compounding deltas (if we added delta to current x/y)
        // BUT here we are adding delta to *current* el.x/y which implies accumulator.
        // ACTUALLY: The React way above accumulates error if we reset start. 
        // Correct way: 
        // 1. Initial State + Total Delta. 
        // OR
        // 2. Incremental updates + Reset DragStart.
        
        // Let's use Incremental + Reset for 'move' to feel responsive, 
        // but for 'resize' we used InitialState so we shouldn't reset DragStart.
        
        if (interactionMode === 'move') {
             setDragStart({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
        setInteractionMode('move');
        setResizeHandle(null);
        setInitialElementState(null);
    };

    // Deselect on BG click
    const handleBgClick = () => setSelectedElement(null);

    return (
        <div 
            className="absolute inset-0 z-50 overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseDown={handleBgClick}
        >
            {[...activeCard.elements].sort((a, b) => a.zIndex - b.zIndex).map(el => (
                <div
                    key={el.id}
                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                    className={`
                        absolute border-2 cursor-move group
                        ${selectedElementId === el.id ? 'border-indigo-500 z-50' : 'border-transparent hover:border-white/50'}
                    `}
                    style={{
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        transform: `rotate(${el.rotation}deg)`
                    }}
                >
                    {/* Resize Handles (Only for selected) */}
                    {selectedElementId === el.id && (
                        <>
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, el, 'tl')}
                                className="absolute -top-2 -left-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-nw-resize" 
                            />
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, el, 'tr')}
                                className="absolute -top-2 -right-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-ne-resize" 
                            />
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, el, 'bl')}
                                className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-sw-resize" 
                            />
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, el, 'br')}
                                className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-se-resize" 
                            />
                        </>
                    )}
                    
                    {/* Label/Debug */}
                    <div className="absolute -top-6 left-0 bg-indigo-500 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {el.type} {Math.round(el.x)},{Math.round(el.y)}
                    </div>
                </div>
            ))}
        </div>
    );
};
