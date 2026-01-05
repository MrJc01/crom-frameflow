import React, { useState } from 'react';
import { X, Settings, Monitor, Info, Film } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'output' | 'advanced' | 'about'>('output');
    
    // Store
    const settings = useAppStore(state => state.settings);
    const updateSettings = useAppStore(state => state.updateSettings);

    if (!isOpen) return null;

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/70'}
            `}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-[800px] h-[500px] bg-[#111] border border-white/10 rounded-xl shadow-2xl flex overflow-hidden">
                
                {/* Sidebar */}
                <div className="w-64 bg-[#0a0a0a] border-r border-white/10 py-6">
                    <div className="px-6 mb-8">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Settings className="w-5 h-5 text-purple-500" />
                            Settings
                        </h2>
                    </div>
                    
                    <nav>
                        <TabButton id="general" label="General" icon={Monitor} />
                        <TabButton id="output" label="Output & Recording" icon={Film} />
                        <TabButton id="advanced" label="Advanced" icon={Settings} />
                        <TabButton id="about" label="About FrameFlow" icon={Info} />
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center px-8 py-6 border-b border-white/5">
                        <h3 className="text-lg font-medium">
                            {activeTab === 'general' && 'General Settings'}
                            {activeTab === 'output' && 'Output Configuration'}
                            {activeTab === 'advanced' && 'Advanced Options'}
                            {activeTab === 'about' && 'About FrameFlow'}
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white/50" />
                        </button>
                    </div>

                    <div className="p-8 flex-1 overflow-y-auto">
                        
                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                             <div className="space-y-6">
                                 <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200 text-sm">
                                     Additional general settings (Theme, Language) coming soon in v1.0.
                                 </div>
                             </div>
                        )}

                        {/* OUTPUT TAB */}
                        {activeTab === 'output' && (
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-white/70">Recording Framerate (FPS)</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[30, 60].map(fps => (
                                            <button
                                                key={fps}
                                                onClick={() => updateSettings({ outputFps: fps as any })}
                                                className={`
                                                    p-4 rounded-lg border text-center transition-all
                                                    ${settings.outputFps === fps 
                                                        ? 'bg-purple-500/20 border-purple-500 text-purple-200' 
                                                        : 'bg-black border-white/10 text-white/50 hover:border-white/30'}
                                                `}
                                            >
                                                <div className="text-2xl font-bold mb-1">{fps}</div>
                                                <div className="text-xs opacity-70">FPS</div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-white/40">
                                        Higher FPS results in smoother video but larger file sizes and higher CPU usage.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ADVANCED TAB */}
                        {activeTab === 'advanced' && (
                             <div className="space-y-6">
                                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                                     <div>
                                         <div className="font-medium mb-1">Debug Statistics</div>
                                         <div className="text-xs text-white/50">Show overlay with FPS, Memory, and Draw Calls</div>
                                     </div>
                                     <button 
                                        onClick={() => updateSettings({ showDebugStats: !settings.showDebugStats })}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showDebugStats ? 'bg-purple-600' : 'bg-white/10'}`}
                                     >
                                         <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.showDebugStats ? 'translate-x-6' : ''}`} />
                                     </button>
                                 </div>
                                 
                                 {/* Preview FPS Control */}
                                 <div className="space-y-3">
                                     <div className="font-medium">Preview Framerate Limit</div>
                                     <div className="flex gap-3">
                                         {[30, 60, 120].map(fps => (
                                             <button
                                                 key={fps}
                                                 onClick={() => updateSettings({ previewFps: fps })}
                                                 className={`
                                                     px-4 py-2 rounded-lg border text-sm transition-all flex-1
                                                     ${settings.previewFps === fps 
                                                         ? 'bg-green-500/20 border-green-500 text-green-200' 
                                                         : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}
                                                 `}
                                             >
                                                 {fps} FPS
                                             </button>
                                         ))}
                                     </div>
                                     <p className="text-xs text-white/40">
                                         Lower FPS saves battery (30 recommended for laptops). Higher FPS is smoother.
                                     </p>
                                 </div>

                                 <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm">
                                     <strong>Warning:</strong> Adjusting internal engine parameters may cause instability.
                                 </div>
                             </div>
                        )}

                        {/* ABOUT TAB */}
                        {activeTab === 'about' && (
                            <div className="text-center space-y-6">
                                <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg transform rotate-3">
                                    <Film className="w-12 h-12 text-white" />
                                </div>
                                
                                <div>
                                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                                        FrameFlow
                                    </h1>
                                    <div className="text-white/50 mt-2">v0.8.0 (Beta)</div>
                                </div>

                                <div className="text-sm text-white/60 max-w-sm mx-auto leading-relaxed">
                                    A professional browser-based Non-Linear Editor (NLE) relying on WebCodecs and CompositionEngine for frame-perfect rendering.
                                </div>
                                
                                <div className="pt-8 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-xl font-bold text-white">React</div>
                                        <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Core</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-white">Canvas</div>
                                        <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Engine</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-white">MP4Box</div>
                                        <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Export</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
