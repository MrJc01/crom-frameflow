
import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { AudioPluginData } from '../types';
import { Sliders, X } from 'lucide-react';

export const EffectsRack: React.FC = () => {
    const selectedClipIds = useAppStore(state => state.selectedClipIds);
    const timeline = useAppStore(state => state.timeline);
    
    // Find Selected Clip
    // For MVP, handling first selected clip
    const clipId = selectedClipIds[0];
    const track = timeline.tracks.find(t => t.clips.some(c => c.id === clipId));
    
    // Also handle Track Selection if we had it.
    // Actually, plugins might be on Track or Clip. 
    // Plan said "Track", but usually effects are easier per clip for simple editors, or per track for DAWs.
    // Let's implement Per Track for now as `AudioEngine` uses `ensureTrack(trackId)`.
    // We need to know which Track is selected. 
    // If a Clip is selected, we show the Track's effects?
    // Or we show Clip Effects? 
    // `AudioEngine` maps `video-master` for all videos currently.
    // This implies we have global effects or track-based effects if we map properly.
    // Let's implement Track-based effects logic.
    // Since `CompositionEngine` maps everything to `video-master` (hack), we can only edit `video-master` track effectively or we need to update `connectVideo`.
    
    // For now, let's assume we are editing the Track that the clip belongs to.
    
    if (!track) return null; // No selection

    const plugins = track.plugins || [];
    
    const updatePlugins = (newPlugins: AudioPluginData[]) => {
        useAppStore.getState().updateTrack(track.id, { plugins: newPlugins });
    };

    const addPlugin = (type: AudioPluginData['type']) => {
        const newPlugin: AudioPluginData = {
            id: crypto.randomUUID(),
            type,
            enabled: true,
            parameters: type === 'eq-3band' ? { low: 0, mid: 0, high: 0 } 
                      : type === 'compressor' ? { threshold: -24, ratio: 12 }
                      : type === 'delay' ? { time: 0.3, mix: 0.5 }
                      : { gain: 1 }
        };
        updatePlugins([...plugins, newPlugin]);
    };

    const updatePluginParam = (pluginId: string, param: string, value: number) => {
        const newPlugins = plugins.map(p => 
            p.id === pluginId 
                ? { ...p, parameters: { ...p.parameters, [param]: value } }
                : p
        );
        updatePlugins(newPlugins);
    };

    const removePlugin = (pluginId: string) => {
        updatePlugins(plugins.filter(p => p.id !== pluginId));
    };

    return (
        <div className="h-full flex flex-col bg-[#111] border-l border-white/10 w-64">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-sm font-medium text-white flex gap-2 items-center">
                    <Sliders className="w-4 h-4" /> Audio Effects
                </h3>
                <span className="text-xs text-white/50">{track.type.toUpperCase()} TRACK</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {plugins.map((p) => (
                    <div key={p.id} className="bg-white/5 rounded p-3 border border-white/10">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-orange-400 uppercase">{p.type}</span>
                            <div className="flex gap-2">
                                <button onClick={() => updatePlugins(plugins.map(px => px.id === p.id ? {...px, enabled: !px.enabled} : px))}>
                                     <div className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                </button>
                                <button onClick={() => removePlugin(p.id)}>
                                    <X className="w-3 h-3 text-white/50 hover:text-white" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            {Object.entries(p.parameters).map(([key, val]) => (
                                <div key={key} className="flex flex-col gap-1">
                                    <div className="flex justify-between text-[10px] text-white/70">
                                        <span>{key}</span>
                                        <span>{val.toFixed(2)}</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min={key === 'gain' ? 0 : -20} 
                                        max={key === 'gain' ? 2 : 20} 
                                        step={0.1}
                                        value={val}
                                        onChange={(e) => updatePluginParam(p.id, key, parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={() => addPlugin('eq-3band')} className="bg-white/5 hover:bg-white/10 p-2 text-xs text-white rounded border border-white/10">+ EQ</button>
                    <button onClick={() => addPlugin('compressor')} className="bg-white/5 hover:bg-white/10 p-2 text-xs text-white rounded border border-white/10">+ Comp</button>
                    <button onClick={() => addPlugin('delay')} className="bg-white/5 hover:bg-white/10 p-2 text-xs text-white rounded border border-white/10">+ Delay</button>
                    <button onClick={() => addPlugin('gain')} className="bg-white/5 hover:bg-white/10 p-2 text-xs text-white rounded border border-white/10">+ Gain</button>
                </div>
            </div>
        </div>
    );
};
