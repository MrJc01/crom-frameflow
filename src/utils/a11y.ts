/**
 * Accessibility Utilities
 * ARIA helpers and keyboard navigation support
 */

import { type RefObject, useEffect, useCallback } from 'react';

// Common ARIA roles
export type AriaRole = 
    | 'button' | 'dialog' | 'alert' | 'alertdialog'
    | 'menu' | 'menuitem' | 'menubar'
    | 'tab' | 'tablist' | 'tabpanel'
    | 'listbox' | 'option'
    | 'slider' | 'spinbutton'
    | 'progressbar' | 'status'
    | 'tooltip' | 'toolbar'
    | 'region' | 'main' | 'navigation'
    | 'grid' | 'row' | 'gridcell';

// ARIA attributes helper
export interface AriaProps {
    role?: AriaRole;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-expanded'?: boolean;
    'aria-selected'?: boolean;
    'aria-checked'?: boolean | 'mixed';
    'aria-disabled'?: boolean;
    'aria-hidden'?: boolean;
    'aria-live'?: 'polite' | 'assertive' | 'off';
    'aria-pressed'?: boolean | 'mixed';
    'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'dialog';
    'aria-controls'?: string;
    'aria-owns'?: string;
    'aria-valuenow'?: number;
    'aria-valuemin'?: number;
    'aria-valuemax'?: number;
    'aria-valuetext'?: string;
    tabIndex?: number;
}

/**
 * Generate ARIA props for a button
 */
export function ariaButton(label: string, options?: { 
    pressed?: boolean; 
    expanded?: boolean;
    disabled?: boolean;
    controls?: string;
}): AriaProps {
    return {
        role: 'button',
        'aria-label': label,
        'aria-pressed': options?.pressed,
        'aria-expanded': options?.expanded,
        'aria-disabled': options?.disabled,
        'aria-controls': options?.controls,
        tabIndex: options?.disabled ? -1 : 0,
    };
}

/**
 * Generate ARIA props for a dialog/modal
 */
export function ariaDialog(labelId: string, options?: {
    describedBy?: string;
    modal?: boolean;
}): AriaProps {
    return {
        role: 'dialog',
        'aria-labelledby': labelId,
        'aria-describedby': options?.describedBy,
        'aria-hidden': false,
    };
}

/**
 * Generate ARIA props for a slider
 */
export function ariaSlider(label: string, value: number, min: number, max: number, valueText?: string): AriaProps {
    return {
        role: 'slider',
        'aria-label': label,
        'aria-valuenow': value,
        'aria-valuemin': min,
        'aria-valuemax': max,
        'aria-valuetext': valueText,
        tabIndex: 0,
    };
}

/**
 * Generate ARIA props for a progress bar
 */
export function ariaProgress(label: string, value: number, max: number = 100): AriaProps {
    return {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuenow': value,
        'aria-valuemin': 0,
        'aria-valuemax': max,
    };
}

/**
 * Generate ARIA props for a tooltip
 */
export function ariaTooltip(id: string): AriaProps {
    return {
        role: 'tooltip',
        'aria-hidden': true,
    };
}

/**
 * Generate ARIA props for a tab
 */
export function ariaTab(selected: boolean, controls: string): AriaProps {
    return {
        role: 'tab',
        'aria-selected': selected,
        'aria-controls': controls,
        tabIndex: selected ? 0 : -1,
    };
}

/**
 * Hook for keyboard navigation in a list
 */
export function useArrowNavigation(
    containerRef: RefObject<HTMLElement>,
    options?: {
        orientation?: 'horizontal' | 'vertical' | 'both';
        wrap?: boolean;
        selector?: string;
    }
): void {
    const { 
        orientation = 'vertical', 
        wrap = true, 
        selector = '[tabindex="0"], button, [role="menuitem"], [role="option"]' 
    } = options || {};

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const container = containerRef.current;
        if (!container) return;

        const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
        const currentIndex = items.findIndex(item => item === document.activeElement);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        const isVertical = orientation === 'vertical' || orientation === 'both';
        const isHorizontal = orientation === 'horizontal' || orientation === 'both';

        if ((e.key === 'ArrowDown' && isVertical) || (e.key === 'ArrowRight' && isHorizontal)) {
            e.preventDefault();
            nextIndex = wrap 
                ? (currentIndex + 1) % items.length 
                : Math.min(currentIndex + 1, items.length - 1);
        } else if ((e.key === 'ArrowUp' && isVertical) || (e.key === 'ArrowLeft' && isHorizontal)) {
            e.preventDefault();
            nextIndex = wrap 
                ? (currentIndex - 1 + items.length) % items.length 
                : Math.max(currentIndex - 1, 0);
        } else if (e.key === 'Home') {
            e.preventDefault();
            nextIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault();
            nextIndex = items.length - 1;
        }

        if (nextIndex !== currentIndex) {
            items[nextIndex].focus();
        }
    }, [containerRef, orientation, wrap, selector]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [containerRef, handleKeyDown]);
}

/**
 * Hook to trap focus within a modal
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement>, isActive: boolean): void {
    useEffect(() => {
        if (!isActive) return;
        
        const container = containerRef.current;
        if (!container) return;

        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus first element on mount
        firstElement?.focus();

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleTabKey);
        return () => document.removeEventListener('keydown', handleTabKey);
    }, [containerRef, isActive]);
}

/**
 * Announce message to screen readers
 */
export function announce(message: string, assertive: boolean = false): void {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    el.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
    el.textContent = message;
    
    document.body.appendChild(el);
    setTimeout(() => document.body.removeChild(el), 1000);
}

/**
 * Generate unique IDs for ARIA relationships
 */
let idCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
    return `${prefix}-${++idCounter}`;
}

/**
 * Screen reader only class (CSS utility)
 */
export const srOnlyStyles = {
    position: 'absolute' as const,
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap' as const,
    border: '0',
};
