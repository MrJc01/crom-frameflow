import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Trash2, X } from 'lucide-react';
import { RecoveryService, type RecoveryInfo } from '../services/RecoveryService';

interface RecoveryPromptProps {
    onRecover: () => void;
    onDiscard: () => void;
}

export const RecoveryPrompt: React.FC<RecoveryPromptProps> = ({ onRecover, onDiscard }) => {
    const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const info = RecoveryService.init();
        if (info.hasRecoveryData) {
            setRecoveryInfo(info);
            setIsVisible(true);
        }
    }, []);

    const handleRecover = () => {
        onRecover();
        setIsVisible(false);
    };

    const handleDiscard = () => {
        RecoveryService.clearRecoveryData();
        onDiscard();
        setIsVisible(false);
    };

    if (!isVisible || !recoveryInfo) return null;

    const formattedTime = recoveryInfo.timestamp 
        ? recoveryInfo.timestamp.toLocaleString() 
        : 'Unknown time';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-xl border border-yellow-500/30 shadow-2xl w-[450px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 bg-yellow-500/10 border-b border-yellow-500/20">
                    <div className="p-2 bg-yellow-500/20 rounded-full">
                        <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Session Recovery</h2>
                        <p className="text-sm text-gray-400">Unsaved work was found</p>
                    </div>
                </div>

                {/* Content */}
                <div className="px-5 py-4">
                    <p className="text-gray-300 text-sm mb-4">
                        FrameFlow detected that your previous session ended unexpectedly. 
                        Would you like to recover your work?
                    </p>
                    
                    <div className="bg-white/5 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Last saved:</span>
                            <span className="text-white font-medium">{formattedTime}</span>
                        </div>
                        {recoveryInfo.description && (
                            <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-gray-400">Contents:</span>
                                <span className="text-white">{recoveryInfo.description}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-white/10 flex gap-3">
                    <button
                        onClick={handleDiscard}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Discard
                    </button>
                    <button
                        onClick={handleRecover}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Recover
                    </button>
                </div>
            </div>
        </div>
    );
};
