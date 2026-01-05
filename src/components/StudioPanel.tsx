
import React, { useEffect, useState, useCallback } from 'react';
import { Mic, Clapperboard, ChevronUp, ChevronDown, Plus, Scissors, Play, Pause, SkipBack, Download, FileVideo } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { db } from '../db/FrameFlowDB';

import { TimelineRuler } from './TimelineRuler';
import { TimelineContextMenu } from './TimelineContextMenu';
import { WaveformClip } from './WaveformClip';
import { RecorderControls } from './RecorderControls';
import { TrackingOverlay } from './TrackingOverlay';
import { EffectsRack } from './EffectsRack';
import { TemplateGallery } from './TemplateGallery';
import { FilePlus, Save } from 'lucide-react';
import { APP_CONFIG } from '../config/constants';
import { useTimeFormat } from '../hooks/useTimeFormat';

export const StudioPanel: React.FC = () => {
    const isRecording = useAppStore(state => state.isRecording);
    const recordingStartTime = useAppStore(state => state.recordingStartTime);
    const setIsRecording = useAppStore(state => state.setIsRecording);
    const setRecordingStartTime = useAppStore(state => state.setRecordingStartTime);
    
    const addClip = useAppStore(state => state.addClip);
    const updateClip = useAppStore(state => state.updateClip);
    const selectedClipIds = useAppStore(state => state.selectedClipIds);
    const setSelectedClips = useAppStore(state => state.setSelectedClips);
    const setContextMenu = useAppStore(state => state.setContextMenu);

    const showTemplateGallery = useAppStore(state => state.showTemplateGallery);
    const setShowTemplateGallery = useAppStore(state => state.setShowTemplateGallery);
    const saveAsTemplate = useAppStore(state => state.saveAsTemplate);

    
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

    // Playhead Ref for direct DOM manipulation (Performance)
    const playheadRef = React.useRef<HTMLDivElement>(null);
    const lastTimeRef = React.useRef(timeline.currentTime);

    // Listen for Engine time updates
    useEffect(() => {
        const engine = (window as any).frameflowEngine;
        if (engine) {
            engine.setTimeUpdateCallback((time: number) => {
                // PERFORMANCE CRITICAL: Direct DOM update to avoid React Re-render loop
                if (playheadRef.current) {
                    const pos = (time / 1000) * timeline.zoom;
                    playheadRef.current.style.left = `${pos}px`;
                }
                lastTimeRef.current = time;
            });
        }
    }, [timeline.zoom]); // Re-bind if zoom changes to ensure calculation is correct

    // Sync store only on pause/stop to keep it "eventually consistent"
    useEffect(() => {
        if (!timeline.isPlaying && Math.abs(timeline.currentTime - lastTimeRef.current) > 100) {
            // If we paused, sync the visual playhead to the store time
             if (playheadRef.current) {
                const pos = (timeline.currentTime / 1000) * timeline.zoom;
                playheadRef.current.style.left = `${pos}px`;
            }
        }
    }, [timeline.currentTime, timeline.isPlaying, timeline.zoom]);

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
                        duration: recordingStartTime ? (Date.now() - recordingStartTime) : APP_CONFIG.PROJECT.DEFAULT_DURATION_MS,
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



    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, asset: any) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            assetId: asset.id,
            name: asset.name,
            duration: APP_CONFIG.PROJECT.DEFAULT_DURATION_MS // Default duration, ideally we read metadata
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
        
    const { formatTime } = useTimeFormat();

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
    const [isExportingGif, setIsExportingGif] = useState(false);

    // Message Handler for Worker
    useEffect(() => {
        const handleExportMessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            if (type === 'EXPORT_PROGRESS') {
                setExportProgress(payload);
            } else if (type === 'EXPORT_COMPLETE') {
                const url = URL.createObjectURL(payload);
                const a = document.createElement('a');
                a.href = url;
                a.download = `composition-${Date.now()}.mp4`;
                a.click();
                URL.revokeObjectURL(url);
                setIsExporting(false);
                setExportProgress(0);
            } else if (type === 'GIF_START') {
                 // Started
            } else if (type === 'GIF_PROGRESS') {
                setExportProgress(payload);
            } else if (type === 'GIF_COMPLETE') {
                const url = URL.createObjectURL(payload);
                const a = document.createElement('a');
                a.href = url;
                a.download = `animation-${Date.now()}.gif`;
                a.click();
                URL.revokeObjectURL(url);
                setIsExportingGif(false);
                setExportProgress(0);
            } else if (type === 'GIF_ERROR') {
                console.error("GIF Export Error:", payload);
                setIsExportingGif(false);
                setExportProgress(0);
                alert("GIF Export Failed");
            }
        };

        const worker = (window as any).frameflowEngine?.worker;
        if (worker) worker.addEventListener('message', handleExportMessage);
        
        return () => {
             const worker = (window as any).frameflowEngine?.worker;
             if (worker) worker.removeEventListener('message', handleExportMessage);
        };
    }, []);

    const handleExportGif = useCallback(() => {
        if (isExportingGif || isExporting) return;
        setIsExportingGif(true);
        setExportProgress(0);
        
        // Use engine to post message
        const engine = (window as any).frameflowEngine;
        if (engine && engine.worker) {
             const duration = timeline.duration;
             engine.worker.postMessage({
                type: 'EXPORT_GIF',
                payload: {
                    start: 0,
                    duration: duration,
                    fps: 15
                }
            });
        }
    }, [isExporting, isExportingGif, timeline.duration]);

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


    const [dragState, setDragState] = useState<{
        clipId: string;
        trackId: string;
        startX: number;
        originalStart: number;
    } | null>(null);

    const handleClipMouseDown = (e: React.MouseEvent, clipId: string, trackId: string) => {
        const clip = timeline.tracks.find(t => t.id === trackId)?.clips.find(c => c.id === clipId);
        if (!clip) return;
        setDragState({
            clipId,
            trackId,
            startX: e.clientX,
            originalStart: clip.start
        });
    };

    // Global mouse move/up handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragState) return;
            
            e.preventDefault();
            const deltaX = e.clientX - dragState.startX;
            const deltaMs = (deltaX / timeline.zoom) * 1000;
            let newStart = dragState.originalStart + deltaMs;
            
            if (newStart < 0) newStart = 0;
            
            // --- Magnetism ---
            const SNAP_THRESHOLD_PX = 15;
            const SNAP_THRESHOLD_MS = (SNAP_THRESHOLD_PX / timeline.zoom) * 1000;
            
            
            // Snap Points: 0, Playhead, Other Clips (Start/End)
            const snapPoints = [0, timeline.currentTime];
            
            // Gather other clips (optimization: memoize this if sluggish)
            timeline.tracks.forEach(t => {
                t.clips.forEach(c => {
                    if (c.id === dragState.clipId) return; // Don't snap to self
                    snapPoints.push(c.start);
                    snapPoints.push(c.start + c.duration);
                });
            });
            
            // Find closest snap point
            let closestDist = Infinity;
            let closestPoint = -1;
            
            // Check Start
            for (const p of snapPoints) {
                const dist = Math.abs(newStart - p);
                if (dist < SNAP_THRESHOLD_MS && dist < closestDist) {
                    closestDist = dist;
                    closestPoint = p;
                }
            }
            
            // Check End (dragged clip end snapping to points)
            const clipDuration = timeline.tracks.find(t => t.id === dragState.trackId)?.clips.find(c => c.id === dragState.clipId)?.duration || 0;
            const currentEnd = newStart + clipDuration;
            
            for (const p of snapPoints) {
                const dist = Math.abs(currentEnd - p);
                // Prioritize start snap if both close? No, closest wins.
                if (dist < SNAP_THRESHOLD_MS && dist < closestDist) {
                    closestDist = dist;
                    closestPoint = p - clipDuration; // Calculate matching start
                }
            }
            
            if (closestDist < SNAP_THRESHOLD_MS) {
                newStart = closestPoint;
            }
            
            updateClip(dragState.clipId, { start: newStart });
        };
        
        const handleMouseUp = () => {
            if (dragState) {
                setDragState(null);
            }
        };
        
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, timeline, updateClip]);


    return (
        <div className={`relative w-full bg-[#0a0a0a] border-t border-white/10 flex flex-col transition-all duration-300 z-50 ${isExpanded ? 'h-96' : 'h-16'}`} >
            <TimelineContextMenu />
            <TrackingOverlay />
            {/* Control Bar */}
            <div className="h-16 flex items-center px-6 gap-4 bg-[#0a0a0a] relative z-20">
                
                {/* Expand Toggle */}
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-white/70 pointer-events-none" /> : <ChevronUp className="w-5 h-5 text-white/70 pointer-events-none" />}
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
                        
                        <div className="flex items-center gap-2">
                             <RecorderControls />
                        </div>

                        <div className="h-6 w-px bg-white/10 mx-2" />
                        
                        {/* Playback Controls */}
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-white/10 rounded-full text-white/70" onClick={() => setTimelineTime(0)}>
                                <SkipBack className="w-4 h-4 pointer-events-none" />
                            </button>
                            <button 
                                className="p-2 bg-white text-black rounded-full hover:bg-white/90"
                                onClick={togglePlayback}
                            >
                                {timeline.isPlaying ? <Pause className="w-4 h-4 fill-current pointer-events-none" /> : <Play className="w-4 h-4 fill-current pointer-events-none" />}
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
                            <Download className="w-3 h-3 pointer-events-none" />
                            {isExporting ? `Exporting ${Math.round(exportProgress)}%` : 'Export MP4'}
                        </button>
                        <button 
                            onClick={handleExportGif}
                            disabled={isExporting}
                            className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1 rounded font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                            <FileVideo className="w-3 h-3 pointer-events-none" />
                            {isExportingGif ? `${Math.round(exportProgress * 100)}%` : 'GIF'}
                        </button>
                        
                        <div className="h-6 w-px bg-white/10 mx-2" />
                        
                        <button 
                            onClick={() => setShowTemplateGallery(true)}
                            className="text-white/70 hover:text-white text-xs px-2 py-1 flex items-center gap-1"
                        >
                            <FilePlus className="w-3 h-3" /> Templates
                        </button>
                         <button 
                            onClick={() => {
                                const name = prompt("Enter template name:");
                                if (name) saveAsTemplate(name);
                            }}
                            className="text-white/70 hover:text-white text-xs px-2 py-1 flex items-center gap-1"
                        >
                            <Save className="w-3 h-3" /> Save Template
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
                             <Plus className="w-3 h-3 pointer-events-none" /> Add Track
                        </button>
                        <button className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-white">
                             <Scissors className="w-3 h-3 pointer-events-none" /> Split
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
                            {/* Ruler (Memoized) */}
                            <TimelineRuler 
                                duration={timeline.duration} 
                                zoom={timeline.zoom} 
                                onSeek={(newTime) => {
                                    const engine = (window as any).frameflowEngine;
                                    if (engine && typeof engine.seek === 'function') {
                                        engine.seek(newTime);
                                    }
                                    setTimelineTime(newTime);
                                    setIsPlaying(false);
                                }}
                            />

                            {/* Tracks */}
                            <div className="pt-6">
                                {timeline.tracks.map(track => (
                                    <div 
                                        key={track.id} 
                                        className="h-24 border-b border-white/5 bg-[#000] relative group transition-colors"
                                        onDragOver={handleTrackDragOver}
                                        onDragLeave={handleTrackDragLeave}
                                        onDrop={(e) => handleTrackDrop(e, track.id)}
                                        onClick={() => setSelectedClips([])}
                                    >
                                        {/* Timeline Ruler */}

                                        {/* Grid */}
                                        <div className="absolute inset-0 flex pointer-events-none opacity-10">
                                             {Array.from({ length: Math.ceil(timeline.duration / 1000) }).map((_, i) => (
                                                <div key={i} className="border-r border-white/20 h-full" style={{ width: `${timeline.zoom}px` }}></div>
                                             ))}
                                        </div>
                                        
                                        {/* Clips */}
                                        {track.clips.map(clip => {
                                            const isSelected = selectedClipIds.includes(clip.id);
                                            // Calculate clip width in pixels for waveform resolution
                                            const clipWidthPx = (clip.duration / 1000) * timeline.zoom;
                                            
                                            return (
                                                <div 
                                                    key={clip.id}
                                                    className={`absolute top-1 bottom-1 rounded cursor-move transition-shadow ${isSelected ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/30' : ''} ${track.type === 'audio' ? 'bg-green-600/80' : 'bg-indigo-600/80'}`}
                                                    style={{
                                                        left: `${(clip.start / 1000) * timeline.zoom}px`,
                                                        width: `${clipWidthPx}px`,
                                                        minWidth: '10px'
                                                    }}
                                                    onMouseDown={(e: React.MouseEvent) => handleClipMouseDown(e, clip.id, track.id)}
                                                    onContextMenu={(e: React.MouseEvent) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setContextMenu({
                                                            isOpen: true,
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                            type: 'clip',
                                                            targetId: clip.id
                                                        });
                                                        if (!isSelected) {
                                                            setSelectedClips([clip.id]);
                                                        }
                                                    }}
                                                >
                                                    <span className="text-xs text-white/70 px-2 truncate block py-1">{clip.name}</span>
                                                    <WaveformClip 
                                                        assetId={clip.assetId} 
                                                        width={clipWidthPx} 
                                                        height={80} 
                                                        color="rgba(255,255,255,0.2)" 
                                                        className="absolute inset-0" 
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            {/* Playhead */}
                             <div 
                                 ref={playheadRef}
                                 className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-40 pointer-events-none"
                                 style={{ left: `${(timeline.currentTime / 1000) * timeline.zoom}px` }}
                            >
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 -ml-[6px] -mt-[1px]"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Effects Rack */}
                <EffectsRack />

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
                                         {asset.type === 'video' ? <Clapperboard className="w-4 h-4 mb-1 pointer-events-none" /> : <Mic className="w-4 h-4 mb-1 pointer-events-none" />}
                                     </div>
                                     <div className="mt-1 text-[10px] text-gray-400 truncate px-1">{asset.name}</div>
                                 </div>
                             ))
                         )}
                     </div>
                </div>
            </div>
            {showTemplateGallery && <TemplateGallery onClose={() => setShowTemplateGallery(false)} />}
        </div>
    );
};
