import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp, Undo, Redo, X} from 'lucide-react';
import { commandManager } from '../engine/commands/CommandManager';
import { useAppStore } from '../stores/useAppStore';

interface HistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose }) => {
    const canUndo = useAppStore(state => state.canUndo);
    const canRedo = useAppStore(state => state.canRedo);
    const undo = useAppStore(state => state.undo);
    const redo = useAppStore(state => state.redo);
    
    const [, forceUpdate] = useState(0);
    
    // Get current history (trigger re-render on open)
    const history = commandManager.getHistory();
    
    const handleUndo = () => {
        undo();
        forceUpdate(n => n + 1);
    };
    
    const handleRedo = () => {
        redo();
        forceUpdate(n => n + 1);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-[400px] max-h-[500px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-amber-400" />
                        Action History
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleUndo}
                            disabled={!canUndo}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
                            title="Undo"
                        >
                            <Undo className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={!canRedo}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
                            title="Redo"
                        >
                            <Redo className="w-4 h-4 text-gray-400" />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* History List */}
                <div className="p-4 overflow-y-auto max-h-[400px]">
                    {history.undoStack.length === 0 && history.redoStack.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                            No actions recorded yet
                        </div>
                    )}

                    {/* Redo Stack (future actions) */}
                    {history.redoStack.length > 0 && (
                        <div className="mb-4">
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <ChevronUp className="w-3 h-3" />
                                Redo Stack ({history.redoStack.length})
                            </div>
                            <div className="space-y-1 opacity-50">
                                {[...history.redoStack].reverse().map((cmd, i) => (
                                    <div 
                                        key={`redo-${i}`}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 text-sm"
                                    >
                                        <Redo className="w-3 h-3" />
                                        {cmd.description || 'Action'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Current Position Indicator */}
                    {(history.undoStack.length > 0 || history.redoStack.length > 0) && (
                        <div className="flex items-center gap-2 my-3">
                            <div className="flex-1 h-px bg-indigo-500/50" />
                            <span className="text-xs text-indigo-400 font-medium">Current</span>
                            <div className="flex-1 h-px bg-indigo-500/50" />
                        </div>
                    )}

                    {/* Undo Stack (past actions) */}
                    {history.undoStack.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <ChevronDown className="w-3 h-3" />
                                Undo Stack ({history.undoStack.length})
                            </div>
                            <div className="space-y-1">
                                {[...history.undoStack].reverse().map((cmd, i) => (
                                    <div 
                                        key={`undo-${i}`}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-colors cursor-pointer"
                                    >
                                        <Undo className="w-3 h-3 text-gray-400" />
                                        {cmd.description || 'Action'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
