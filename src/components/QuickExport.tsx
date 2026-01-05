import React, { useState } from 'react';
import { Download, X, Youtube, Film, Image, Twitter, Check } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface QuickExportProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ExportPreset {
    id: string;
    name: string;
    platform: string;
    width: number;
    height: number;
    fps: number;
    bitrate: string;
    icon: React.ReactNode;
    color: string;
    description: string;
}

const EXPORT_PRESETS: ExportPreset[] = [
    {
        id: 'youtube-hd',
        name: 'YouTube HD',
        platform: 'YouTube',
        width: 1920,
        height: 1080,
        fps: 30,
        bitrate: '8 Mbps',
        icon: <Youtube className="w-6 h-6" />,
        color: '#FF0000',
        description: 'Standard 1080p for YouTube uploads'
    },
    {
        id: 'youtube-4k',
        name: 'YouTube 4K',
        platform: 'YouTube',
        width: 3840,
        height: 2160,
        fps: 30,
        bitrate: '35 Mbps',
        icon: <Youtube className="w-6 h-6" />,
        color: '#FF0000',
        description: 'Ultra HD for high quality content'
    },
    {
        id: 'tiktok',
        name: 'TikTok',
        platform: 'TikTok',
        width: 1080,
        height: 1920,
        fps: 30,
        bitrate: '6 Mbps',
        icon: <Film className="w-6 h-6" />,
        color: '#00f2ea',
        description: 'Vertical format for TikTok'
    },
    {
        id: 'instagram-reel',
        name: 'Instagram Reel',
        platform: 'Instagram',
        width: 1080,
        height: 1920,
        fps: 30,
        bitrate: '6 Mbps',
        icon: <Film className="w-6 h-6" />,
        color: '#E1306C',
        description: 'Vertical 9:16 for Reels'
    },
    {
        id: 'instagram-post',
        name: 'Instagram Post',
        platform: 'Instagram',
        width: 1080,
        height: 1080,
        fps: 30,
        bitrate: '5 Mbps',
        icon: <Image className="w-6 h-6" />,
        color: '#E1306C',
        description: 'Square format for feed posts'
    },
    {
        id: 'twitter',
        name: 'Twitter/X',
        platform: 'Twitter',
        width: 1280,
        height: 720,
        fps: 30,
        bitrate: '5 Mbps',
        icon: <Twitter className="w-6 h-6" />,
        color: '#1DA1F2',
        description: 'Compressed 720p for Twitter'
    }
];

export const QuickExport: React.FC<QuickExportProps> = ({ isOpen, onClose }) => {
    const [selectedPreset, setSelectedPreset] = useState<ExportPreset | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleExport = async () => {
        if (!selectedPreset) return;
        
        setIsExporting(true);
        setProgress(0);
        
        // Dynamic import to avoid circular dependencies
        const { getExportManager } = await import('../engine/ExportManager');
        const manager = getExportManager();
        
        // Get timeline state from store (simplified - in real use, pass actual state)
        // For now, we'll pass placeholder data
        const config = {
            width: selectedPreset.width,
            height: selectedPreset.height,
            fps: selectedPreset.fps,
            duration: 10, // Placeholder - should come from timeline
            timeline: null,
            activeCard: null
        };
        
        try {
            await manager.startExport(config, {
                onProgress: (p) => {
                    setProgress(Math.round(p.progress * 100));
                },
                onComplete: () => {
                    setIsExporting(false);
                    setProgress(100);
                    alert(`Export complete! (${selectedPreset.name})`);
                    onClose();
                },
                onError: (error) => {
                    setIsExporting(false);
                    alert(`Export failed: ${error}`);
                }
            });
        } catch (error) {
            setIsExporting(false);
            alert(`Export failed: ${error}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-[560px] max-h-[700px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Download className="w-5 h-5 text-green-400" />
                        Quick Export
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Platform Presets */}
                <div className="p-4">
                    <p className="text-sm text-gray-400 mb-4">
                        Select a platform for optimized export settings
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {EXPORT_PRESETS.map(preset => (
                            <Tooltip key={preset.id} content={preset.description} position="top">
                                <button
                                    onClick={() => setSelectedPreset(preset)}
                                    className={`group flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                                        selectedPreset?.id === preset.id
                                            ? 'bg-white/10 border-indigo-500'
                                            : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div 
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                        style={{ backgroundColor: preset.color + '20', color: preset.color }}
                                    >
                                        {preset.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-white text-sm">
                                            {preset.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {preset.width}x{preset.height} • {preset.fps}fps
                                        </div>
                                    </div>
                                    {selectedPreset?.id === preset.id && (
                                        <Check className="w-5 h-5 text-indigo-400" />
                                    )}
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>

                {/* Export Details */}
                {selectedPreset && (
                    <div className="px-4 pb-4">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Resolution</div>
                                    <div className="text-sm font-medium text-white">
                                        {selectedPreset.width}x{selectedPreset.height}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Frame Rate</div>
                                    <div className="text-sm font-medium text-white">
                                        {selectedPreset.fps} fps
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Bitrate</div>
                                    <div className="text-sm font-medium text-white">
                                        {selectedPreset.bitrate}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!selectedPreset || isExporting}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                    >
                        {isExporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Export
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
