import React, { useState } from 'react';
import { FolderArchive, Download, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { collectFiles, downloadArchive, formatFileSize, type CollectResult } from '../utils/collectFiles';
import { useAppStore } from '../stores/useAppStore';

interface CollectFilesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CollectFilesModal: React.FC<CollectFilesModalProps> = ({ isOpen, onClose }) => {
    const cards = useAppStore(state => state.cards);
    const timeline = useAppStore(state => state.timeline);
    
    const [projectName, setProjectName] = useState('My Project');
    const [includeAssets, setIncludeAssets] = useState(true);
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [isCollecting, setIsCollecting] = useState(false);
    const [result, setResult] = useState<CollectResult | null>(null);

    if (!isOpen) return null;

    const handleCollect = async () => {
        setIsCollecting(true);
        setResult(null);

        const collected = await collectFiles(
            { cards, timeline, version: '1.0.0' },
            { projectName, includeAssets, includeMetadata }
        );

        setResult(collected);
        setIsCollecting(false);

        if (collected.success && collected.blob && collected.filename) {
            downloadArchive(collected.blob, collected.filename);
        }
    };

    const handleClose = () => {
        setResult(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-[480px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <FolderArchive className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Collect Files</h2>
                            <p className="text-sm text-gray-400">Bundle project for backup or transfer</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-4 space-y-4">
                    {/* Project Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Project Name</label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                            placeholder="Enter project name"
                        />
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                            <input
                                type="checkbox"
                                checked={includeAssets}
                                onChange={(e) => setIncludeAssets(e.target.checked)}
                                className="w-4 h-4 accent-indigo-500"
                            />
                            <div>
                                <span className="text-white text-sm font-medium">Include Assets</span>
                                <p className="text-xs text-gray-400">Bundle all images, videos, and audio files</p>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                            <input
                                type="checkbox"
                                checked={includeMetadata}
                                onChange={(e) => setIncludeMetadata(e.target.checked)}
                                className="w-4 h-4 accent-indigo-500"
                            />
                            <div>
                                <span className="text-white text-sm font-medium">Include Metadata</span>
                                <p className="text-xs text-gray-400">Add project stats and export info</p>
                            </div>
                        </label>
                    </div>

                    {/* Result */}
                    {result && (
                        <div className={`p-3 rounded-lg flex items-start gap-3 ${
                            result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                            {result.success ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                                    <div>
                                        <p className="text-green-400 font-medium text-sm">Export Complete!</p>
                                        {result.stats && (
                                            <p className="text-green-300/70 text-xs mt-1">
                                                {result.stats.assetCount} assets • {formatFileSize(result.stats.totalSize)}
                                            </p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                                    <div>
                                        <p className="text-red-400 font-medium text-sm">Export Failed</p>
                                        <p className="text-red-300/70 text-xs mt-1">{result.error}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCollect}
                        disabled={isCollecting || !projectName.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        {isCollecting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Collecting...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Export Archive
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
