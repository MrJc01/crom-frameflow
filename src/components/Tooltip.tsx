import React, { useState, useRef, useEffect, type ReactNode } from 'react';

interface TooltipProps {
    content: string;
    children: ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
    content, 
    children, 
    position = 'top',
    delay = 400 
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showTooltip = () => {
        timeoutRef.current = setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setCoords(calculatePosition(rect, position));
                setIsVisible(true);
            }
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    const calculatePosition = (rect: DOMRect, pos: string) => {
        const offset = 8;
        switch (pos) {
            case 'top':
                return { x: rect.left + rect.width / 2, y: rect.top - offset };
            case 'bottom':
                return { x: rect.left + rect.width / 2, y: rect.bottom + offset };
            case 'left':
                return { x: rect.left - offset, y: rect.top + rect.height / 2 };
            case 'right':
                return { x: rect.right + offset, y: rect.top + rect.height / 2 };
            default:
                return { x: rect.left + rect.width / 2, y: rect.top - offset };
        }
    };

    const getTransformOrigin = () => {
        switch (position) {
            case 'top': return 'bottom center';
            case 'bottom': return 'top center';
            case 'left': return 'right center';
            case 'right': return 'left center';
            default: return 'bottom center';
        }
    };

    const getTransform = () => {
        switch (position) {
            case 'top': return 'translate(-50%, -100%)';
            case 'bottom': return 'translate(-50%, 0)';
            case 'left': return 'translate(-100%, -50%)';
            case 'right': return 'translate(0, -50%)';
            default: return 'translate(-50%, -100%)';
        }
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <>
            <div 
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                className="inline-flex"
            >
                {children}
            </div>
            
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="fixed z-[9999] px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-lg border border-white/10 pointer-events-none whitespace-nowrap transition-opacity duration-150"
                    style={{
                        left: coords.x,
                        top: coords.y,
                        transform: getTransform(),
                        transformOrigin: getTransformOrigin(),
                        opacity: isVisible ? 1 : 0
                    }}
                >
                    {content}
                    {/* Arrow */}
                    <div 
                        className={`absolute w-2 h-2 bg-gray-900 border-white/10 rotate-45 ${
                            position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r' :
                            position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l' :
                            position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2 border-r border-t' :
                            'left-[-4px] top-1/2 -translate-y-1/2 border-l border-b'
                        }`}
                    />
                </div>
            )}
        </>
    );
};
