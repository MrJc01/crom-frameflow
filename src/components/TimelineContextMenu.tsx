import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Copy, Trash, Scissors, Box, Sparkles, Palette, Move } from 'lucide-react';

export const TimelineContextMenu: React.FC = () => {
    const contextMenu = useAppStore(state => state.contextMenu);
    const closeContextMenu = useAppStore(state => state.closeContextMenu);
    const duplicateClip = useAppStore(state => state.duplicateClip);
    const removeClip = useAppStore(state => state.removeClip);

    // Close when clicking outside
    useEffect(() => {
        const handleClick = () => closeContextMenu();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [closeContextMenu]);

    if (!contextMenu.isOpen) return null;

    const handleAction = (action: () => void) => {
        action();
        closeContextMenu();
    };

    return (
        <div 
            className="fixed bg-[#1a1a1a] border border-white/10 rounded shadow-xl z-[100] py-1 min-w-[150px]"
            style={{ 
                left: contextMenu.x, 
                top: contextMenu.y 
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {contextMenu.type === 'clip' && contextMenu.targetId && (
                <>
                    <button 
                        onClick={() => handleAction(() => duplicateClip(contextMenu.targetId!))}
                        className="w-full text-left px-4 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2"
                    >
                        <Copy className="w-3 h-3" /> Duplicate
                        <span className="ml-auto text-white/30 text-[10px]">Ctrl+D</span>
                    </button>
                    {/* Placeholder for Split */}
                    <button 
                         className="w-full text-left px-4 py-2 text-xs text-white/50 cursor-not-allowed flex items-center gap-2"
                    >
                        <Scissors className="w-3 h-3" /> Split
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button 
                        onClick={() => handleAction(() => {
                           // Toggle Green Screen Logic
                           const state = useAppStore.getState();
                           const clip = state.timeline.tracks
                                .flatMap(t => t.clips)
                                .find(c => c.id === contextMenu.targetId);
                           
                           if (clip) {
                               const isEnabled = clip.chromaKey?.enabled ?? false;
                               state.updateClip(clip.id, {
                                   chromaKey: {
                                       enabled: !isEnabled,
                                       color: [0, 1, 0], // Green
                                       similarity: 0.4,
                                       smoothness: 0.1
                                   }
                               });
                           }
                        })}
                        className="w-full text-left px-4 py-2 text-xs text-green-400 hover:bg-white/10 flex items-center gap-2"
                    >
                        <div className="w-3 h-3 bg-green-500 rounded-sm" /> Green Screen
                    </button>
                    <button 
                        onClick={() => handleAction(() => {
                           // Toggle Text 3D Logic
                           const state = useAppStore.getState();
                           const clip = state.timeline.tracks
                                .flatMap(t => t.clips)
                                .find(c => c.id === contextMenu.targetId);
                           
                           if (clip) {
                               const isEnabled = clip.text3d?.enabled ?? false;
                               state.updateClip(clip.id, {
                                   text3d: {
                                       enabled: !isEnabled,
                                       depth: 30, // Default depth
                                       color: '#000000'
                                   }
                               });
                           }
                        })}
                        className="w-full text-left px-4 py-2 text-xs text-blue-400 hover:bg-white/10 flex items-center gap-2"
                    >
                        <Box className="w-3 h-3" /> Make 3D
                    </button>
                    <button 
                        onClick={() => handleAction(() => {
                           // Toggle Magic Remove
                           const state = useAppStore.getState();
                           const clip = state.timeline.tracks
                                .flatMap(t => t.clips)
                                .find(c => c.id === contextMenu.targetId);
                           
                           if (clip) {
                               const isEnabled = clip.segmentation?.enabled ?? false;
                               state.updateClip(clip.id, {
                                   segmentation: {
                                       enabled: !isEnabled
                                   }
                               });
                           }
                        })}
                        className="w-full text-left px-4 py-2 text-xs text-purple-400 hover:bg-white/10 flex items-center gap-2"
                    >
                        <Sparkles className="w-3 h-3" /> Magic Remove
                    </button>
                    <button 
                        onClick={() => {
                            // Open File Picker for LUT
                             const input = document.createElement('input');
                             input.type = 'file';
                             input.accept = '.cube';
                             input.onchange = async (e) => {
                                 const file = (e.target as HTMLInputElement).files?.[0];
                                 if (!file) return;
                                 
                                 // We need to store this URL or Content?
                                 // For now, create ObjectURL
                                 const url = URL.createObjectURL(file);
                                 
                                 const state = useAppStore.getState();
                                 state.updateClip(contextMenu.targetId!, {
                                     lut: {
                                         name: file.name,
                                         source: url
                                     }
                                 });
                                 closeContextMenu();
                             };
                             input.click();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-yellow-400 hover:bg-white/10 flex items-center gap-2"
                    >
                        <Palette className="w-3 h-3" /> Apply LUT...
                    </button>
                    <button 
                        onClick={() => {
                             // Dispatch Event to Open Overlay
                             const event = new CustomEvent('open-motion-tracking', { 
                                 detail: { clipId: contextMenu.targetId } 
                             });
                             window.dispatchEvent(event);
                             closeContextMenu();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-orange-400 hover:bg-white/10 flex items-center gap-2"
                    >
                        <Move className="w-3 h-3" /> Track Motion...
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button 
                        onClick={() => handleAction(() => removeClip(contextMenu.targetId!))}
                        className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/10 flex items-center gap-2"
                    >
                        <Trash className="w-3 h-3" /> Delete
                        <span className="ml-auto text-white/30 text-[10px]">Del</span>
                    </button>
                </>
            )}
        </div>
    );
};
