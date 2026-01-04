import React, { useState } from 'react';
import { useAppStore, type SceneElement } from '../stores/useAppStore';

export const EditorOverlay: React.FC = () => {
    const activeCardId = useAppStore(state => state.activeCardId);
    const cards = useAppStore(state => state.cards);
    const updateCard = useAppStore(state => state.updateCard);
    const updateCardElements = useAppStore(state => state.updateCardElements);
    const selectedElementId = useAppStore(state => state.selectedElementId);
    const setSelectedElement = useAppStore(state => state.setSelectedElement);

    const activeCard = cards.find(c => c.id === activeCardId);
    
    // Interaction State
    const [interactionMode, setInteractionMode] = useState<'move' | 'resize' | 'pan'>('move');
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
    const [initialElementState, setInitialElementState] = useState<SceneElement | null>(null);
    const [tempElement, setTempElement] = useState<SceneElement | null>(null);

    if (!activeCard) return null;

    // --- Stage Scaling Logic ---
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
             for (const entry of entries) {
                 setContainerSize({
                     width: entry.contentRect.width,
                     height: entry.contentRect.height
                 });
             }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Calculate Transform Specs
    const getStageTransform = () => {
        if (!activeCard) return { scale: 1, x: 0, y: 0 };
        
        if (activeCard.layoutMode === 'infinite') {
            return {
                scale: 1,
                x: -(activeCard.viewportX || 0),
                y: -(activeCard.viewportY || 0)
            };
        } else {
            // Fixed Mode Auto-Fit
            const sceneW = activeCard.width || 1920;
            const sceneH = activeCard.height || 1080;
            const padding = 40;
            const availW = containerSize.width - padding * 2;
            const availH = containerSize.height - padding * 2;
             
            if (availW <= 0 || availH <= 0) return { scale: 1, x: 0, y: 0 };

            const scale = Math.min(availW / sceneW, availH / sceneH);
            const x = (containerSize.width - sceneW * scale) / 2;
            const y = (containerSize.height - sceneH * scale) / 2;
            
            return { scale, x, y };
        }
    };

    const stage = getStageTransform();

    // Coordinate Conversion
    // Mouse Event Client XY -> Local Scene XY
    const getSceneCursor = (clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        
        // Mouse relative to container (0,0 is top-left of container)
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;
        
        // Remove Stage Transform
        // formula: screen = scene * scale + offset
        // scene = (screen - offset) / scale
        
        // However, we apply translate then scale? 
        // In Engine: ctx.translate(tx, ty); ctx.scale(s, s); 
        // So drawing at (0,0) lands at (tx, ty).
        
        const sceneX = (relX - stage.x) / stage.scale;
        const sceneY = (relY - stage.y) / stage.scale;
        
        return { x: sceneX, y: sceneY };
    };

    const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
        e.stopPropagation();
        setSelectedElement(elementId);
        setInteractionMode('move');
        setIsDragging(true);
        const { x, y } = getSceneCursor(e.clientX, e.clientY);
        setDragStart({ x, y });
        
        const el = activeCard.elements.find(el => el.id === elementId);
        if (el) setInitialElementState({...el});
    };

    const handleResizeStart = (e: React.MouseEvent, element: SceneElement, handle: string) => {
        e.stopPropagation();
        setSelectedElement(element.id); 
        setInteractionMode('resize');
        setResizeHandle(handle);
        setIsDragging(true);
        const { x, y } = getSceneCursor(e.clientX, e.clientY);
        setDragStart({ x, y });
        setInitialElementState({...element});
    };

    const handleBgMouseDown = (e: React.MouseEvent) => {
        if (activeCard.layoutMode === 'infinite') {
            setInteractionMode('pan');
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY }); // Keep raw for pan?
            // Actually, for pan, we update viewportX/Y.
            // If viewportX moves +10, scene moves left -10.
            // Panning is intuitive if we track screen delta.
            setDragStart({ x: e.clientX, y: e.clientY }); 
            setSelectedElement(null);
        } else {
            setSelectedElement(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragStart || !activeCard) return;

        if (interactionMode === 'pan') {
             // Pan logic for Infinite Mode (using RAW screen deltas)
             const deltaX = e.clientX - dragStart.x;
             const deltaY = e.clientY - dragStart.y;
             
             const currentVx = activeCard.viewportX || 0;
             const currentVy = activeCard.viewportY || 0;
             
             updateCard(activeCard.id, {
                 viewportX: currentVx - deltaX, 
                 viewportY: currentVy - deltaY
             });
             setDragStart({ x: e.clientX, y: e.clientY });
             return;
        }
        
        // For Move/Resize, use Scene Coordinates
        const currentScenePos = getSceneCursor(e.clientX, e.clientY);
        const deltaX = currentScenePos.x - dragStart.x;
        const deltaY = currentScenePos.y - dragStart.y;

        if (!selectedElementId || !initialElementState) return;

        // Use INITIAL state + Total Delta
        const s = initialElementState;
        let newEl = { ...s };

        if (interactionMode === 'move') {
            newEl.x = s.x + deltaX;
            newEl.y = s.y + deltaY;
        } else if (interactionMode === 'resize') {
            switch (resizeHandle) {
                case 'br': 
                     newEl.width = Math.max(10, s.width + deltaX);
                     newEl.height = Math.max(10, s.height + deltaY);
                     break;
                case 'bl': 
                     newEl.x = s.x + deltaX; 
                     newEl.width = Math.max(10, s.width - deltaX);
                     newEl.height = Math.max(10, s.height + deltaY);
                     break;
                case 'tr': 
                     newEl.y = s.y + deltaY;
                     newEl.width = Math.max(10, s.width + deltaX);
                     newEl.height = Math.max(10, s.height - deltaY);
                     break;
                case 'tl': 
                     newEl.x = s.x + deltaX;
                     newEl.y = s.y + deltaY;
                     newEl.width = Math.max(10, s.width - deltaX);
                     newEl.height = Math.max(10, s.height - deltaY);
                     break;
            }
        }
        
        // UPDATE LOCAL STATE ONLY (No Store Update)
        setTempElement(newEl);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
        setInteractionMode('move');
        setResizeHandle(null);
        
        // Commit changes to Store
        if (tempElement && activeCard) {
            const newElements = activeCard.elements.map(el => 
                el.id === tempElement.id ? tempElement : el
            );
            updateCardElements(activeCard.id, newElements);
        }
        
        setInitialElementState(null);
        setTempElement(null);
    };

    const renderContent = () => (
        <>
        {[...activeCard.elements].sort((a, b) => a.zIndex - b.zIndex).map(el => {
                 // Use temp state if dragging this element
                 const displayEl = (tempElement && tempElement.id === el.id) ? tempElement : el;

                 return (
                    <div
                        key={el.id}
                        onMouseDown={(e) => handleMouseDown(e, el.id)}
                        className={`
                            absolute border-2 cursor-move group
                            ${selectedElementId === el.id ? 'border-indigo-500 z-50' : 'border-transparent hover:border-white/50'}
                        `}
                        style={{
                            left: displayEl.x,
                            top: displayEl.y,
                            width: displayEl.width,
                            height: displayEl.height,
                            transform: `rotate(${displayEl.rotation}deg)`
                        }}
                    >
                        {/* Resize Handles (Only for selected) */}
                        {selectedElementId === el.id && (
                        <>
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, displayEl, 'tl')}
                                className="absolute -top-2 -left-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-nw-resize" 
                            />
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, displayEl, 'tr')}
                                className="absolute -top-2 -right-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-ne-resize" 
                            />
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, displayEl, 'bl')}
                                className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-sw-resize" 
                            />
                            <div 
                                onMouseDown={(e) => handleResizeStart(e, displayEl, 'br')}
                                className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border border-indigo-500 rounded-full cursor-se-resize" 
                            />
                        </>
                    )}
                    
                    {/* Label/Debug */}
                    <div className="absolute -top-6 left-0 bg-indigo-500 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {displayEl.type} {Math.round(displayEl.x)},{Math.round(displayEl.y)}
                    </div>
                </div>

            );
        })}
        </>
    );

    return (
        <div 
            ref={containerRef}
            className={`absolute inset-0 z-50 overflow-hidden ${activeCard.layoutMode === 'infinite' ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseDown={handleBgMouseDown}
        >
             {/* Stage Container */}
             <div 
                style={{
                    transform: `translate(${stage.x}px, ${stage.y}px) scale(${stage.scale})`,
                    transformOrigin: '0 0',
                    width: activeCard.layoutMode === 'fixed' ? (activeCard.width || 1920) : '100%',
                    height: activeCard.layoutMode === 'fixed' ? (activeCard.height || 1080) : '100%',
                    // For infinite mode, width/height being 100% means we are limiting content?
                    // No, invalid. Infinite mode elements are absolute.
                    // If infinite, we apply transform translate only.
                    // The elements are just children.
                    
                    // Actually, for Infinite mode, we want the container to be effectively infinite or just 0x0
                    // and elements positioned relative to it.
                    // Let's stick to the transform logic:
                    // scale=1, x=-viewportX, y=-viewportY.
                    // If we apply this to this `div`, then children at `el.x` will be visually at `el.x - viewportX`.
                    // Perfect.
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    // background: 'rgba(255,0,0,0.1)' // debug
                }}
             >
                {renderContent()}
             </div>
        </div>
    );
};
