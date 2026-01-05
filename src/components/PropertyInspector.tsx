import React from 'react';
import { useAppStore, type SceneElement } from '../stores/useAppStore';
import { ArrowUp, ArrowDown, Trash2, Layers as LayersIcon, Diamond } from 'lucide-react';
import { interpolateProperty } from '../utils/interpolation';

export const PropertyInspector: React.FC = () => {
    const activeCardId = useAppStore(state => state.activeCardId);
    const selectedElementId = useAppStore(state => state.selectedElementId);
    
    // Optimized: Only re-render if active card changes
    const activeCard = useAppStore(state => state.cards.find(c => c.id === state.activeCardId));
    
    // Optimized: Only re-render if selected element changes
    const selectedElement = useAppStore(state => {
        const card = state.cards.find(c => c.id === state.activeCardId);
        return card?.elements.find(el => el.id === state.selectedElementId);
    });

    const updateCardElements = useAppStore(state => state.updateCardElements);
    const timeline = useAppStore(state => state.timeline);

    const updateCard = useAppStore(state => state.updateCard);
    
    // Actions
    const addKeyframe = useAppStore(state => state.addKeyframe);
    const removeKeyframe = useAppStore(state => state.removeKeyframe);

    // If no element is selected, show Scene Properties (Resolution)
    if (activeCard && !selectedElement) {
        return (
            <div className="p-4 space-y-6 text-sm text-gray-300">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="font-semibold text-white uppercase tracking-wider text-xs">Scene Settings</h3>
                </div>

                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">Layout Mode</h4>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => updateCard(activeCard.id, { layoutMode: 'fixed' })}
                            className={`flex-1 p-2 rounded border text-xs text-center ${activeCard.layoutMode !== 'infinite' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                            Fixed Slide
                        </button>
                        <button 
                            onClick={() => updateCard(activeCard.id, { layoutMode: 'infinite' })}
                            className={`flex-1 p-2 rounded border text-xs text-center ${activeCard.layoutMode === 'infinite' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                            Infinite Canvas
                        </button>
                    </div>
                </div>

                {activeCard.layoutMode !== 'infinite' && (
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">Resolution</h4>
                    <div className="grid grid-cols-1 gap-2">
                         <button 
                            onClick={() => updateCard(activeCard.id, { width: 1920, height: 1080 })}
                            className={`p-2 rounded border text-xs flex items-center justify-between ${activeCard.width === 1920 && activeCard.height === 1080 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                            <span>Landscape (16:9)</span>
                            <span className="opacity-50">1920x1080</span>
                         </button>
                         <button 
                            onClick={() => updateCard(activeCard.id, { width: 1080, height: 1920 })}
                            className={`p-2 rounded border text-xs flex items-center justify-between ${activeCard.width === 1080 && activeCard.height === 1920 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                            <span>Portrait (9:16)</span>
                            <span className="opacity-50">1080x1920</span>
                         </button>
                         <button 
                            onClick={() => updateCard(activeCard.id, { width: 1080, height: 1080 })}
                            className={`p-2 rounded border text-xs flex items-center justify-between ${activeCard.width === 1080 && activeCard.height === 1080 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                            <span>Square (1:1)</span>
                            <span className="opacity-50">1080x1080</span>
                         </button>
                    </div>
                </div>
                )}

                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">Background</h4>
                     <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Color</label>
                        <input 
                            type="color" 
                            value={activeCard.backgroundColor || '#000000'}
                            onChange={(e) => updateCard(activeCard.id, { backgroundColor: e.target.value })}
                            className="w-full h-8 bg-transparent border border-white/10 rounded cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        );
    }
    
    if (!activeCard) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
                <LayersIcon className="w-8 h-8 mb-2 opacity-20" />
                <p>No Active Scene</p>
            </div>
        );
    }

    if (!selectedElement) return null;

    const toggleKeyframe = (prop: string, value: number) => {
        if (!selectedElement || !activeCard) return;
        const time = timeline?.currentTime ?? 0;
        const hasKey = selectedElement.animations?.some(k => k.property === prop && Math.abs(k.time - time) < 0.05);

        if (hasKey) {
            removeKeyframe(activeCard.id, selectedElement.id, prop, time);
        } else {
            addKeyframe(activeCard.id, selectedElement.id, prop, time, value);
        }
    };

    const getValue = (prop: string, fallback: number) => {
        if (!selectedElement) return fallback;
        const time = timeline?.currentTime ?? 0;
        return interpolateProperty(selectedElement.animations, prop, time, fallback);
    };

    const KeyframeBtn = ({ prop, value }: { prop: string, value: number }) => {
        const time = timeline?.currentTime ?? 0;
        const activeKeyframe = selectedElement?.animations?.find(k => k.property === prop && Math.abs(k.time - time) < 0.05);
        const hasAnyKey = selectedElement?.animations?.some(k => k.property === prop);
        
        return (
            <div className="flex items-center gap-1">
                {activeKeyframe && (
                    <select 
                        value={activeKeyframe.easing || 'linear'}
                        onChange={(e) => addKeyframe(activeCard!.id, selectedElement!.id, prop, time, value, e.target.value as any)}
                        className="w-16 bg-transparent text-[8px] text-gray-500 border-none outline-none cursor-pointer hover:text-indigo-400 appearance-none text-right"
                        title="Easing Function"
                    >
                        <option value="linear">Linear</option>
                        <option value="easeInQuad">In Quad</option>
                        <option value="easeOutQuad">Out Quad</option>
                        <option value="easeInOutQuad">In/Out Quad</option>
                        <option value="easeOutBounce">Bounce</option>
                        <option value="easeOutElastic">Elastic</option>
                        <option value="easeInOutSine">Smooth</option>
                    </select>
                )}
                <button 
                    onClick={() => toggleKeyframe(prop, value)}
                    className={`p-1 rounded hover:bg-white/10 ${activeKeyframe ? 'text-red-500' : (hasAnyKey ? 'text-indigo-400' : 'text-gray-600')}`}
                    title={activeKeyframe ? "Remove Keyframe" : "Add Keyframe"}
                >
                    <Diamond className={`w-3 h-3 ${activeKeyframe ? 'fill-current' : ''}`} />
                </button>
            </div>
        );
    };

    const handleChange = (key: keyof SceneElement, value: any) => {
        const time = timeline?.currentTime ?? 0;
        
        // Auto-Keyframe
        const supportedProps = ['x', 'y', 'width', 'height', 'rotation', 'opacity'];
        if (supportedProps.includes(key) && typeof value === 'number') {
             const hasAnyKey = selectedElement?.animations?.some(k => k.property === key);
             if (hasAnyKey) {
                 addKeyframe(activeCard.id, selectedElement.id, key, time, value);
             }
        }
        // Handle ViewParams separately or use string key for them
        if (key === 'viewParams' && typeof value === 'object') {
             // For simplify, we just update the object. 
             // Ideally we check each sub-prop (yaw, pitch, fov)
             // But let's assume if 360 mode is on, we auto-key viewParams props if they have keys.
             // This is complex. Let's stick to explicit KeyframeBtn for now for 360.
        }

        const newElements = activeCard.elements.map(el => 
            el.id === selectedElement.id ? { ...el, [key]: value } : el
        );
        updateCardElements(activeCard.id, newElements);
    };

    const handleDelete = () => {
        const newElements = activeCard.elements.filter(el => el.id !== selectedElement.id);
        updateCardElements(activeCard.id, newElements);
    };

    const handleLayer = (direction: 'up' | 'down') => {
        const newElements = activeCard.elements.map(el => 
            el.id === selectedElement.id ? { ...el, zIndex: el.zIndex + (direction === 'up' ? 1 : -1) } : el
        );
        updateCardElements(activeCard.id, newElements);
    };

    return (
        <div className="p-4 space-y-6 text-sm text-gray-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-semibold text-white uppercase tracking-wider text-xs">Inspector</h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                    {selectedElement.type.toUpperCase()}
                </span>
            </div>

            {/* Transform */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Transform</h4>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                             <label className="text-[10px] text-gray-400">X Position</label>
                             <KeyframeBtn prop="x" value={getValue('x', selectedElement.x)} />
                        </div>
                        <input 
                            type="number" 
                            value={Math.round(getValue('x', selectedElement.x))} 
                            onChange={(e) => handleChange('x', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                             <label className="text-[10px] text-gray-400">Y Position</label>
                             <KeyframeBtn prop="y" value={getValue('y', selectedElement.y)} />
                        </div>
                        <input 
                            type="number" 
                            value={Math.round(getValue('y', selectedElement.y))} 
                            onChange={(e) => handleChange('y', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Width</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.width)} 
                            onChange={(e) => handleChange('width', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Height</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.height)} 
                            onChange={(e) => handleChange('height', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div className="col-span-2">
                        <div className="flex justify-between items-center mb-1">
                             <label className="text-[10px] text-gray-400">Rotation ({Math.round(getValue('rotation', selectedElement.rotation))}°)</label>
                             <KeyframeBtn prop="rotation" value={getValue('rotation', selectedElement.rotation)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="range" 
                                min="0" max="360" 
                                value={getValue('rotation', selectedElement.rotation)} 
                                onChange={(e) => handleChange('rotation', Number(e.target.value))}
                                className="flex-1 accent-indigo-500"
                            />
                            <input 
                                type="number" 
                                value={Math.round(selectedElement.rotation)} 
                                onChange={(e) => handleChange('rotation', Number(e.target.value))}
                                className="w-12 bg-black/20 border border-white/10 rounded px-1 py-1 focus:border-indigo-500 outline-none text-right text-xs"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Projection / 360 Settings */}
            <div className="space-y-3 border-t border-white/10 pt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Projection</h4>
                <div>
                     <select 
                        value={selectedElement.projection || 'flat'}
                        onChange={(e) => handleChange('projection', e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                     >
                         <option value="flat">Flat (2D)</option>
                         <option value="equirectangular">360° (Equirectangular)</option>
                     </select>
                </div>

                {selectedElement.projection === 'equirectangular' && (
                    <div className="space-y-2 mt-2 pl-2 border-l-2 border-indigo-500/20">
                         <div>
                            <label className="text-[10px] text-gray-400 block mb-1">Yaw (Pan) {Math.round(selectedElement.viewParams?.yaw || 0)}°</label>
                            <input 
                                type="range" min="-180" max="180" 
                                value={selectedElement.viewParams?.yaw || 0}
                                onChange={(e) => {
                                    const current = selectedElement.viewParams || { yaw: 0, pitch: 0, fov: 90 };
                                    handleChange('viewParams', { ...current, yaw: Number(e.target.value) });
                                }}
                                className="w-full accent-indigo-500"
                            />
                         </div>
                         <div>
                            <label className="text-[10px] text-gray-400 block mb-1">Pitch (Tilt) {Math.round(selectedElement.viewParams?.pitch || 0)}°</label>
                            <input 
                                type="range" min="-90" max="90" 
                                value={selectedElement.viewParams?.pitch || 0}
                                onChange={(e) => {
                                    const current = selectedElement.viewParams || { yaw: 0, pitch: 0, fov: 90 };
                                    handleChange('viewParams', { ...current, pitch: Number(e.target.value) });
                                }}
                                className="w-full accent-indigo-500"
                            />
                         </div>
                         <div>
                            <label className="text-[10px] text-gray-400 block mb-1">FOV (Zoom) {Math.round(selectedElement.viewParams?.fov || 90)}°</label>
                            <input 
                                type="range" min="10" max="160" 
                                value={selectedElement.viewParams?.fov || 90}
                                onChange={(e) => {
                                    const current = selectedElement.viewParams || { yaw: 0, pitch: 0, fov: 90 };
                                    handleChange('viewParams', { ...current, fov: Number(e.target.value) });
                                }}
                                className="w-full accent-indigo-500"
                            />
                         </div>
                    </div>
                )}
            </div>

            {/* Layering & Actions */}
            
            {/* Text Properties (Conditional) */}
            {selectedElement.type === 'text' && (
                <div className="space-y-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase">Typography</h4>
                    <div className="space-y-2">
                        <div>
                            <label className="text-[10px] text-gray-400 block mb-1">Content</label>
                            <textarea 
                                value={selectedElement.content} 
                                onChange={(e) => handleChange('content', e.target.value as any)}
                                className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-xs resize-none h-16"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-gray-400 block mb-1">Size (px)</label>
                                <input 
                                    type="number" 
                                    value={selectedElement.fontSize || 30} 
                                    onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                                    className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block mb-1">Color</label>
                                <input 
                                    type="color" 
                                    value={selectedElement.color || '#ffffff'} 
                                    onChange={(e) => handleChange('color', e.target.value as any)}
                                    className="w-full h-7 bg-transparent border border-white/10 rounded cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* General Style (Opacity) */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Appearance</h4>
                <div>
                     <div className="flex justify-between items-center mb-1">
                         <label className="text-[10px] text-gray-400">Opacity</label>
                         <KeyframeBtn prop="opacity" value={getValue('opacity', selectedElement.opacity ?? 1)} />
                     </div>
                     <input 
                        type="range" 
                        min="0" max="1" step="0.1"
                        value={getValue('opacity', selectedElement.opacity ?? 1)} 
                        onChange={(e) => handleChange('opacity', Number(e.target.value))}
                        className="w-full accent-indigo-500"
                     />
                </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => handleLayer('up')} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 p-2 rounded transition-colors">
                        <ArrowUp className="w-4 h-4" /> <span className="text-xs">Bring Fwd</span>
                     </button>
                     <button onClick={() => handleLayer('down')} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 p-2 rounded transition-colors">
                        <ArrowDown className="w-4 h-4" /> <span className="text-xs">Send Back</span>
                     </button>
                </div>
                <button 
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/50 p-2 rounded transition-colors mt-2"
                >
                    <Trash2 className="w-4 h-4" /> Delete Element
                </button>
            </div>
            
             {/* Clone Action */}
             <div className="border-t border-white/10 pt-4">
                 <button 
                    onClick={() => {
                        const newId = `${selectedElement.type}-${Date.now()}`;
                        const newElement: SceneElement = {
                            ...selectedElement,
                            id: newId,
                            x: selectedElement.x + 20,
                            y: selectedElement.y + 20
                        };
                        const newElements = [...activeCard.elements, newElement];
                        updateCardElements(activeCard.id, newElements);
                        // Store will auto-update? 
                        // We might want to select it too, but store doesn't have handy 'addAndSelect' yet.
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded transition-colors"
                >
                    <LayersIcon className="w-4 h-4" /> Duplicate Element
                </button>
             </div>
            
             {/* Camera Properties */}
             {selectedElement.type === 'camera' && (
                <CameraInspector 
                    element={selectedElement} 
                    updateElement={(updates) => {
                         const newElements = activeCard.elements.map(el => 
                            el.id === selectedElement.id ? { ...el, ...updates } : el
                         );
                         updateCardElements(activeCard.id, newElements);
                    }}
                />
             )}
        </div>
    );
};

// Sub-component for Camera Props
const CameraInspector: React.FC<{ 
    element: SceneElement, 
    updateElement: (updates: Partial<SceneElement>) => void 
}> = ({ element, updateElement }) => {
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);

    React.useEffect(() => {
        // Enumerate devices
        const fetchDevices = async () => {
             try {
                 // Ensure permission first? 
                 // navigator.mediaDevices.getUserMedia({video: true}) might be needed to get labels
                 const devs = await navigator.mediaDevices.enumerateDevices();
                 setDevices(devs.filter(d => d.kind === 'videoinput'));
             } catch (e) {
                 console.error("Failed to enumerate devices", e);
             }
        };
        fetchDevices();
    }, []);
    
    const handleStartScreen = () => {
         window.dispatchEvent(new CustomEvent('frameflow:start-screen-share', { detail: { elementId: element.id } }));
         updateElement({ sourceType: 'display' });
    };

    return (
        <div className="space-y-3 border-t border-white/10 pt-4">
             <h4 className="text-xs font-medium text-gray-500 uppercase">Video Source</h4>
             
             <div className="flex gap-2 mb-2">
                 <button 
                    onClick={() => updateElement({ sourceType: 'camera' })}
                    className={`flex-1 p-1 text-xs rounded border ${(!element.sourceType || element.sourceType === 'camera') ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'border-transparent hover:bg-white/5'}`}
                 >Camera</button>
                 <button 
                    onClick={() => updateElement({ sourceType: 'display' })}
                    className={`flex-1 p-1 text-xs rounded border ${element.sourceType === 'display' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'border-transparent hover:bg-white/5'}`}
                 >Screen</button>
             </div>
             
             {(!element.sourceType || element.sourceType === 'camera') ? (
                 <div>
                     <label className="text-[10px] text-gray-400 block mb-1">Device</label>
                     <select 
                        value={element.deviceId || ''}
                        onChange={(e) => updateElement({ deviceId: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                     >
                         <option value="">Default Camera</option>
                         {devices.map(d => (
                             <option key={d.deviceId} value={d.deviceId}>
                                 {d.label || `Camera ${d.deviceId.slice(0,5)}...`}
                             </option>
                         ))}
                     </select>
                 </div>
             ) : (
                 <div>
                      <button 
                        onClick={handleStartScreen}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs"
                      >
                          Select Screen / Window
                      </button>
                      <p className="text-[10px] text-gray-500 mt-1">Click to trigger browser picker</p>
                 </div>
             )}
        </div>
    );
};
