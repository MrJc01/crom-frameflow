import React, { useEffect, useState } from 'react';
import { Mic, Clapperboard, ChevronUp, ChevronDown, Plus, Scissors, Play, Pause, SkipBack, Download } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { db } from '../db/FrameFlowDB';
import { PreviewMonitor } from './PreviewMonitor';

export const StudioPanel: React.FC = () => {
    const isRecording = useAppStore(state => state.isRecording);
    const recordingStartTime = useAppStore(state => state.recordingStartTime);
    const setIsRecording = useAppStore(state => state.setIsRecording);
    const setRecordingStartTime = useAppStore(state => state.setRecordingStartTime);
    
    const addClip = useAppStore(state => state.addClip);
    
    // Timeline State
    const timeline = useAppStore(state => state.timeline);
    const setTimelineTime = useAppStore(state => state.setTimelineTime);
    const setIsPlaying = useAppStore(state => state.setIsPlaying);
    
    const [elapsed, setElapsed] = useState("00:00");
    const [isExpanded, setIsExpanded] = useState(false); // Drawer state

    // Asset Bin State
    const [showAssetBin, setShowAssetBin] = useState(false);
    const [assets, setAssets] = useState<any[]>([]);

    // Load assets when bin opens
    useEffect(() => {
        if (showAssetBin) {
            db.getAllAssets().then(setAssets);
        }
    }, [showAssetBin]);

    // Sync Engine Time
    useEffect(() => {
        const engine = (window as any).frameflowEngine;
        if (engine) {
            engine.setTimelineState(timeline);
            
            // Only toggle engine mode if Expanded
            if (isExpanded) {
                engine.setRenderMode('TIMELINE');
            } else {
                engine.setRenderMode('COMPOSITION');
            }
        }
    }, [timeline, isExpanded]);

    // Listen for Engine time updates
    useEffect(() => {
        const engine = (window as any).frameflowEngine;
        if (engine) {
            engine.setTimeUpdateCallback((time: number) => {
                setTimelineTime(time);
            });
        }
    }, []);

    // Timer Logic
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording && recordingStartTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const diff = Math.floor((now - recordingStartTime) / 1000);
                const mins = Math.floor(diff / 60).toString().padStart(2, '0');
                const secs = (diff % 60).toString().padStart(2, '0');
                setElapsed(`${mins}:${secs}`);
            }, 1000);
        } else {
            setElapsed("00:00");
        }
        return () => clearInterval(interval);
    }, [isRecording, recordingStartTime]);

    const handleToggleRecord = async () => {
        const engine = (window as any).frameflowEngine;
        if (!engine) return;

        if (isRecording) {
            // STOP
            try {
                const blob = await engine.stopRecording();
                setIsRecording(false);
                setRecordingStartTime(null);

                const fileName = `Rec_${new Date().toLocaleString().replace(/[:/]/g, '-')}.webm`;
                const file = new File([blob], fileName, { type: 'video/webm' });
                
                const assetId = await db.addAsset(file);
                
                console.log("Recording saved to Asset Library:", assetId);

                // --- Auto-Add to Timeline Logic ---
                const videoTrack = timeline.tracks.find(t => t.type === 'video') || timeline.tracks[0];
                if (videoTrack) {
                    // Find end of last clip to append
                    const lastClip = videoTrack.clips.reduce((prev, current) => (prev.start + prev.duration > current.start + current.duration) ? prev : current, { start: 0, duration: 0 } as any);
                    const startTime = lastClip.id ? (lastClip.start + lastClip.duration) : 0;
                    
                    // Add to store
                    addClip(videoTrack.id, {
                        id: crypto.randomUUID(),
                        assetId: assetId,
                        name: fileName,
                        start: startTime,
                        duration: 5000, // TODO: ideally get duration from blob metadata
                        offset: 0
                    });

                    // Auto-Switch to Edit Mode
                    setIsExpanded(true);
                    setTimelineTime(startTime);
                    
                    // Ensure engine knows about the new asset immediately for playback
                    // (The engine's resolveAsset will hit DB, which is fine, but we could optimize later)
                }
                // ----------------------------------
                
            } catch (err) {
                console.error("Stop recording failed", err);
            }
        } else {
            // START
            try {
                await engine.startRecording();
                setIsRecording(true);
                setRecordingStartTime(Date.now());
            } catch (err) {
                alert("Failed to start recording. Ensure camera permissions.");
                console.error(err);
            }
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const x = e.nativeEvent.offsetX; 
        const timeInSec = x / timeline.zoom;
        setTimelineTime(timeInSec * 1000);
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, asset: any) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            assetId: asset.id,
            name: asset.name,
            duration: 5000 // Default duration, ideally we read metadata
        }));
    };

    const handleTrackDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    };

    const handleTrackDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.backgroundColor = '';
    };

    const handleTrackDrop = (e: React.DragEvent<HTMLDivElement>, trackId: string) => {
        e.preventDefault();
        e.currentTarget.style.backgroundColor = '';
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            
            // Calculate drop time based on X position
            const dropX = e.nativeEvent.offsetX;
            const startTime = (dropX / timeline.zoom) * 1000;
            
            addClip(trackId, {
                id: crypto.randomUUID(),
                assetId: data.assetId,
                name: data.name,
                start: startTime,
                duration: data.duration,
                offset: 0
            });
            
        } catch (err) {
            console.error("Failed to drop clip", err);
        }
    };
        
    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Sync Quality to Engine
    const previewQuality = useAppStore(state => state.previewQuality);
    const setPreviewQuality = useAppStore(state => state.setPreviewQuality);
    
    useEffect(() => {
        const engine = (window as any).frameflowEngine;
        if (engine && typeof engine.setPreviewQuality === 'function') {
            engine.setPreviewQuality(previewQuality);
        }
    }, [previewQuality]);

    const togglePlayback = () => {
        const engine = (window as any).frameflowEngine;
        if (engine) {
            if (timeline.isPlaying) {
                engine.pause();
            } else {
                engine.play();
            }
        }
        setIsPlaying(!timeline.isPlaying);
    };

    // Calculate Grid
    const totalWidth = (timeline.duration / 1000) * timeline.zoom;

    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const handleExport = async () => {
        const engine = (window as any).frameflowEngine;
        if (!engine) return;

        if (confirm("Start Frame-Perfect MP4 Export? This might take a while.")) {
            setIsExporting(true);
            setExportProgress(0);
            try {
                await engine.exportVideo((p: number) => setExportProgress(p));
            } catch (e) {
                console.error("Export Failed", e);
                alert("Export Failed. See console.");
            } finally {
                setIsExporting(false);
            }
        }
    };

    return (
        <div className={`fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 flex flex-col transition-all duration-300 z-50 ${isExpanded ? 'h-96' : 'h-16'}`} >
            
            {/* Monitor PIP */}
            {isExpanded && <PreviewMonitor />}

            {/* Control Bar */}
            <div className="h-16 flex items-center px-6 gap-4 bg-[#0a0a0a] relative z-20">
                
                {/* Expand Toggle */}
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-white/70" /> : <ChevronUp className="w-5 h-5 text-white/70" />}
                </button>

                {/* Record Button & Status */}
                <button 
                    onClick={handleToggleRecord}
                    className={`
                        w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                        ${isRecording ? 'bg-red-500/20 scale-110' : 'hover:bg-red-500/20 group'}
                    `}
                >
                    <div className={`
                        rounded-full transition-all duration-300
                        ${isRecording ? 'w-4 h-4 bg-red-500 rounded-sm' : 'w-6 h-6 bg-red-500 group-hover:scale-90'}
                    `} />
                </button>

                <div className="flex flex-col">
                    <span className={`text-sm font-mono font-medium ${isRecording ? 'text-red-500' : 'text-white'}`}>
                        {isRecording ? elapsed : (isExpanded ? formatTime(timeline.currentTime) : "00:00")}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/50">
                        {isRecording ? "Recording" : (isExpanded ? "Timeline" : "Ready")}
                    </span>
                </div>

                <div className="h-8 w-px bg-white/10 mx-2" />

                {/* Timeline Toolbar (Only when expanded) */}
                {isExpanded && (
                    <div className="flex items-center gap-2">
                        <button 
                             onClick={() => setShowAssetBin(!showAssetBin)}
                             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showAssetBin ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 hover:bg-white/10 text-white/70'}`}
                        >
                            <Clapperboard className="w-4 h-4" />
                            Assets
                        </button>
                        
                        <div className="h-6 w-px bg-white/10 mx-2" />
                        
                        {/* Playback Controls */}
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-white/10 rounded-full text-white/70">
                                <SkipBack className="w-4 h-4" onClick={() => setTimelineTime(0)} />
                            </button>
                            <button 
                                className="p-2 bg-white text-black rounded-full hover:bg-white/90"
                                onClick={togglePlayback}
                            >
                                {timeline.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                            </button>
                        </div>

                         <div className="h-6 w-px bg-white/10 mx-2" />

                        {/* Quality Dropdown - Optimization */}
                         <div className="relative group">
                            <select 
                                value={previewQuality}
                                onChange={(e) => setPreviewQuality(e.target.value as any)}
                                className="appearance-none bg-black border border-white/20 text-xs text-white/70 pl-2 pr-6 py-1 rounded cursor-pointer hover:border-white/40 focus:outline-none focus:border-blue-500"
                            >
                                <option value="auto">Auto Quality</option>
                                <option value="1080p">1080p (High)</option>
                                <option value="720p">720p (Med)</option>
                                <option value="360p">360p (Fast)</option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-white/50 absolute right-2 top-1.5 pointer-events-none" />
                        </div>
                        
                        <div className="h-6 w-px bg-white/10 mx-2" />
                        
                        {/* Export Button */}
                        <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1 rounded font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                            <Download className="w-3 h-3" />
                            {isExporting ? `Exporting ${Math.round(exportProgress)}%` : 'Export MP4'}
                        </button>
                    </div>
                )}
            </div>

            {/* Main Area: Split Timeline and Asset Bin */}
            <div className="flex-1 overflow-hidden bg-[#111] flex relative">
                
                {/* Timeline Section */}
                <div className="flex-1 flex flex-col relative">
                     {/* Toolbar */}
                    <div className="h-8 border-b border-white/5 flex items-center px-4 gap-2 bg-[#1a1a1a]">
                        <button className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-white">
                             <Plus className="w-3 h-3" /> Add Track
                        </button>
                        <button className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-white">
                             <Scissors className="w-3 h-3" /> Split
                        </button>
                    </div>

                    {/* Tracks Scroll Area */}
                    <div className="flex-1 overflow-y-auto overflow-x-auto relative custom-scrollbar flex">
                         {/* Track Headers */}
                        <div className="sticky left-0 bg-[#0a0a0a] z-30 w-32 shrink-0 border-r border-white/5 pt-6">
                             {timeline.tracks.map(track => (
                                <div key={track.id} className="h-24 border-b border-white/5 p-2 flex flex-col justify-center">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{track.type}</span>
                                    <span className="text-[10px] text-gray-600 truncate">{track.id}</span>
                                </div>
                             ))}
                        </div>

                        {/* Content */}
                        <div className="relative min-w-full" style={{ width: `${totalWidth}px` }}>
                            {/* Ruler */}
                            <div 
                                className="h-6 border-b border-white/10 bg-[#111] absolute top-0 left-0 right-0 z-20 flex cursor-pointer hover:bg-white/5"
                                onClick={handleSeek}
                            >
                                {Array.from({ length: Math.ceil(timeline.duration / 1000) }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className="border-l border-white/20 h-full text-[10px] text-gray-500 pl-1 select-none"
                                        style={{ width: `${timeline.zoom}px` }}
                                    >
                                        {i}s
                                    </div>
                                ))}
                            </div>

                            {/* Tracks */}
                            <div className="pt-6">
                                {timeline.tracks.map(track => (
                                    <div 
                                        key={track.id} 
                                        className="h-24 border-b border-white/5 bg-[#000] relative group transition-colors"
                                        onDragOver={handleTrackDragOver}
                                        onDragLeave={handleTrackDragLeave}
                                        onDrop={(e) => handleTrackDrop(e, track.id)}
                                    >
                                        {/* Grid */}
                                        <div className="absolute inset-0 flex pointer-events-none opacity-10">
                                             {Array.from({ length: Math.ceil(timeline.duration / 1000) }).map((_, i) => (
                                                <div key={i} className="border-r border-white/20 h-full" style={{ width: `${timeline.zoom}px` }}></div>
                                             ))}
                                        </div>
                                        
                                        {/* Clips */}
                                        {track.clips.map(clip => (
                                            <div 
                                                key={clip.id}
                                                className="absolute top-2 bottom-2 bg-blue-900/50 border border-blue-500/50 rounded overflow-hidden cursor-pointer hover:brightness-110 active:brightness-125 z-10"
                                                style={{
                                                    left: `${(clip.start / 1000) * timeline.zoom}px`,
                                                    width: `${(clip.duration / 1000) * timeline.zoom}px`
                                                }}
                                                title={clip.name}
                                            >
                                                <div className="px-1 py-0.5 text-[10px] text-white/90 truncate bg-black/40 w-full">
                                                    {clip.name}
                                                </div>
                                                <div className="w-full h-full opacity-30 bg-repeat-x" style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, rgba(255,255,255,0.2) 50%)', backgroundSize: '4px 100%' }}></div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Playhead */}
                             <div 
                                 className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-40 pointer-events-none"
                                 style={{ left: `${(timeline.currentTime / 1000) * timeline.zoom}px` }}
                            >
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 -ml-[6px] -mt-[1px]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Asset Bin Drawer */}
                <div className={`w-64 bg-[#0a0a0a] border-l border-white/10 flex flex-col transition-all duration-300 ${showAssetBin ? 'mr-0' : '-mr-64'}`}>
                     <div className="h-8 border-b border-white/5 flex items-center px-4 bg-[#111]">
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Assets</span>
                     </div>
                     <div className="flex-1 overflow-y-auto p-2 space-y-2">
                         {assets.length === 0 ? (
                             <div className="text-center py-8 text-gray-600 text-xs">No assets recorded</div>
                         ) : (
                             assets.map(asset => (
                                 <div 
                                     key={asset.id}
                                     className="aspect-video bg-[#1a1a1a] rounded border border-white/5 p-1 cursor-grab active:cursor-grabbing hover:border-white/20 transition-colors"
                                     draggable
                                     onDragStart={(e) => handleDragStart(e, asset)}
                                 >
                                     <div className="w-full h-full bg-black/50 flex items-center justify-center text-gray-500 text-xs">
                                         {asset.type === 'video' ? <Clapperboard className="w-4 h-4 mb-1" /> : <Mic className="w-4 h-4 mb-1" />}
                                     </div>
                                     <div className="mt-1 text-[10px] text-gray-400 truncate px-1">{asset.name}</div>
                                 </div>
                             ))
                         )}
                     </div>
                </div>
            </div>
        </div>
    );
};
