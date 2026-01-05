import React, { useState, useCallback, useEffect } from 'react';
import { RotateCw } from 'lucide-react';

interface TransformGizmoProps {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number; // degrees
    scale: number; // viewport scale factor
    onMove: (dx: number, dy: number) => void;
    onResize: (newWidth: number, newHeight: number, anchor: string) => void;
    onRotate: (newRotation: number) => void;
    onTransformEnd: () => void;
}

type HandleType = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export const TransformGizmo: React.FC<TransformGizmoProps> = ({
    x, y, width, height, rotation, scale,
    onMove, onResize, onRotate, onTransformEnd
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<HandleType | null>(null);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [startBounds, setStartBounds] = useState({ x, y, width, height, rotation });

    // Convert to screen coords
    const screenX = x * scale;
    const screenY = y * scale;
    const screenW = width * scale;
    const screenH = height * scale;

    const handleSize = 10;
    const rotateHandleOffset = 30;

    const startDrag = useCallback((e: React.MouseEvent, type: HandleType) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragType(type);
        setStartPos({ x: e.clientX, y: e.clientY });
        setStartBounds({ x, y, width, height, rotation });
    }, [x, y, width, height, rotation]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = (e.clientX - startPos.x) / scale;
            const dy = (e.clientY - startPos.y) / scale;

            switch (dragType) {
                case 'move':
                    onMove(dx, dy);
                    break;
                case 'se':
                    onResize(startBounds.width + dx, startBounds.height + dy, 'nw');
                    break;
                case 'e':
                    onResize(startBounds.width + dx, startBounds.height, 'w');
                    break;
                case 's':
                    onResize(startBounds.width, startBounds.height + dy, 'n');
                    break;
                case 'nw':
                    onResize(startBounds.width - dx, startBounds.height - dy, 'se');
                    break;
                case 'n':
                    onResize(startBounds.width, startBounds.height - dy, 's');
                    break;
                case 'ne':
                    onResize(startBounds.width + dx, startBounds.height - dy, 'sw');
                    break;
                case 'sw':
                    onResize(startBounds.width - dx, startBounds.height + dy, 'ne');
                    break;
                case 'w':
                    onResize(startBounds.width - dx, startBounds.height, 'e');
                    break;
                case 'rotate': {
                    // Calculate angle from center
                    const centerX = screenX + screenW / 2;
                    const centerY = screenY + screenH / 2;
                    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
                    const degrees = (angle * 180 / Math.PI) + 90; // Offset so 0 is up
                    onRotate(degrees);
                    break;
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setDragType(null);
            onTransformEnd();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragType, startPos, startBounds, scale, onMove, onResize, onRotate, onTransformEnd, screenX, screenY, screenW, screenH]);

    // Handle positions
    const handles: { type: HandleType; left: number; top: number; cursor: string }[] = [
        { type: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
        { type: 'n', left: screenW / 2, top: 0, cursor: 'ns-resize' },
        { type: 'ne', left: screenW, top: 0, cursor: 'nesw-resize' },
        { type: 'e', left: screenW, top: screenH / 2, cursor: 'ew-resize' },
        { type: 'se', left: screenW, top: screenH, cursor: 'nwse-resize' },
        { type: 's', left: screenW / 2, top: screenH, cursor: 'ns-resize' },
        { type: 'sw', left: 0, top: screenH, cursor: 'nesw-resize' },
        { type: 'w', left: 0, top: screenH / 2, cursor: 'ew-resize' },
    ];

    return (
        <div 
            className="absolute pointer-events-none"
            style={{
                left: screenX,
                top: screenY,
                width: screenW,
                height: screenH,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center center'
            }}
        >
            {/* Border (clickable for move) */}
            <div 
                className="absolute inset-0 border-2 border-indigo-500 pointer-events-auto cursor-move"
                onMouseDown={(e) => startDrag(e, 'move')}
            />

            {/* Corner/Edge Handles */}
            {handles.map(({ type, left, top, cursor }) => (
                <div
                    key={type}
                    className="absolute bg-white border-2 border-indigo-500 rounded-sm pointer-events-auto"
                    style={{
                        left: left - handleSize / 2,
                        top: top - handleSize / 2,
                        width: handleSize,
                        height: handleSize,
                        cursor
                    }}
                    onMouseDown={(e) => startDrag(e, type)}
                />
            ))}

            {/* Rotation Handle */}
            <div
                className="absolute flex flex-col items-center pointer-events-auto cursor-grab"
                style={{
                    left: screenW / 2 - 10,
                    top: -rotateHandleOffset - handleSize,
                    width: 20
                }}
                onMouseDown={(e) => startDrag(e, 'rotate')}
            >
                <div className="w-[2px] h-[25px] bg-indigo-500" />
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <RotateCw className="w-3 h-3 text-white" />
                </div>
            </div>
        </div>
    );
};
