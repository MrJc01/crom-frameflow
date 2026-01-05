import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export const KeyboardShortcutsManager: React.FC = () => {
    // Actions
    const undo = useAppStore(state => state.undo);
    const redo = useAppStore(state => state.redo);
    const isPlaying = useAppStore(state => state.timeline.isPlaying);
    const setIsPlaying = useAppStore(state => state.setIsPlaying);

    const removeElement = useAppStore(state => state.removeElement);
    const removeClip = useAppStore(state => state.removeClip);
    
    // State to check selection - accessed via getState inside effect mainly
    // Note: We don't have selectedClipId in global store yet? 
    // We have selectedElementId.
    // We need to know what is selected to delete it.
    // For now, let's assume we might select elements in the card OR clips in the timeline.
    // We previously saw 'selectedElementId' in uiSlice.
    
    // Timeline Selection logic is missing from store?
    // Let's check UiSlice again or assume we need to add it.
    // The task "Multi-selection in Timeline" implies we don't have it yet.
    // For now, let's just handle undo/redo/space.

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Play/Pause: Space
            if (e.code === 'Space') {
                e.preventDefault();
                setIsPlaying(!isPlaying);
            }

            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if (((e.ctrlKey || e.metaKey) && e.code === 'KeyY') || 
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ')) {
                e.preventDefault();
                redo();
            }
            
            // Delete: Delete or Backspace
            if (e.code === 'Delete' || e.code === 'Backspace') {
                 // Access current state fresh to avoid stale closures if dependencies aren't perfect
                 const state = useAppStore.getState();
                 
                 if (state.selectedElementId && state.activeCardId) {
                     removeElement(state.activeCardId, state.selectedElementId);
                     // Clear selection after delete?
                     // Ideally UI slice should react to this or we call clearSelection
                 } else if (state.selectedClipIds && state.selectedClipIds.length > 0) {
                     state.selectedClipIds.forEach(id => removeClip(id));
                     // Clear selection
                     useAppStore.setState({ selectedClipIds: [] });
                 }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, undo, redo, setIsPlaying, removeElement, removeClip]);

    return null; // Headless component
};
