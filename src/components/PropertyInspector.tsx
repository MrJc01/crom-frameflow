import React from 'react';
import { useAppStore, type SceneElement } from '../stores/useAppStore';
import { ArrowUp, ArrowDown, Trash2, Layers as LayersIcon } from 'lucide-react';

export const PropertyInspector: React.FC = () => {
    const activeCardId = useAppStore(state => state.activeCardId);
    const cards = useAppStore(state => state.cards);
    const selectedElementId = useAppStore(state => state.selectedElementId);
    const updateCardElements = useAppStore(state => state.updateCardElements);

    const activeCard = cards.find(c => c.id === activeCardId);
    const selectedElement = activeCard?.elements.find(el => el.id === selectedElementId);

    const updateCard = useAppStore(state => state.updateCard);


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

    const handleChange = (key: keyof SceneElement, value: string | number) => {
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
                        <label className="text-[10px] text-gray-400 block mb-1">X Position</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.x)} 
                            onChange={(e) => handleChange('x', Number(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 focus:border-indigo-500 outline-none text-right"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Y Position</label>
                        <input 
                            type="number" 
                            value={Math.round(selectedElement.y)} 
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
                        <label className="text-[10px] text-gray-400 block mb-1">Rotation ({Math.round(selectedElement.rotation)}°)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="range" 
                                min="0" max="360" 
                                value={selectedElement.rotation} 
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
                     <label className="text-[10px] text-gray-400 block mb-1">Opacity</label>
                     <input 
                        type="range" 
                        min="0" max="1" step="0.1"
                        value={selectedElement.opacity ?? 1} 
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
