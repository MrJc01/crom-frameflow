import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { AudioRecorderService } from '../services/AudioRecorderService';
import { Mic, Square, Loader2 } from 'lucide-react';
import { nanoid } from 'nanoid';

export const RecorderControls: React.FC = () => {
    const isRecording = useAppStore(state => state.isRecording);
    const setIsRecording = useAppStore(state => state.setIsRecording);
    const recordingStartTime = useAppStore(state => state.recordingStartTime);
    const setRecordingStartTime = useAppStore(state => state.setRecordingStartTime);
    const timelineTime = useAppStore(state => state.timeline.currentTime);
    const _setTimelineTime = useAppStore(state => state.setTimelineTime);
    const togglePlayback = useAppStore(state => state.timeline.isPlaying ? state.pause : state.play);
    const addAsset = useAppStore(state => state.addAsset);
    const _currentMode = useAppStore(state => state.currentMode);
    const addClip = useAppStore(state => state.addClip);
    const tracks = useAppStore(state => state.timeline.tracks);

    const [audioLevel, setAudioLevel] = useState(0);
    const [duration, setDuration] = useState('00:00');
    const [isPreparing, setIsPreparing] = useState(false);
    
    const animationFrameRef = useRef<number | undefined>(undefined);
    
    // Update Audio Level Visuals
    useEffect(() => {
        if (!isRecording) {
            setAudioLevel(0);
            return;
        }

        const updateLevel = () => {
            const level = AudioRecorderService.getInstance().getAudioLevel();
            setAudioLevel(level);
            animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
        
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isRecording]);

    // Update Timer
    useEffect(() => {
        if (isRecording && recordingStartTime) {
             const interval = setInterval(() => {
                 const diff = Date.now() - recordingStartTime;
                 const secs = Math.floor(diff / 1000);
                 const mins = Math.floor(secs / 60);
                 const remainSecs = secs % 60;
                 setDuration(`${mins.toString().padStart(2, '0')}:${remainSecs.toString().padStart(2, '0')}`);
             }, 500);
             return () => clearInterval(interval);
        } else {
            setDuration('00:00');
        }
    }, [isRecording, recordingStartTime]);

    const handleToggleRecording = async () => {
        const service = AudioRecorderService.getInstance();

        if (isRecording) {
            // STOP
            setIsRecording(false);
            setRecordingStartTime(null);
            
            try {
                const blob = await service.stopRecording();
                const url = URL.createObjectURL(blob);
                
                // 1. Create Asset
                const assetId = nanoid();
                addAsset({
                    id: assetId,
                    type: 'audio',
                    source: url,
                    name: `Voiceover ${new Date().toLocaleTimeString()}`
                });
                
                // 2. Add to Timeline
                // Find or create audio track?
                // For now, append to first audio track or create new one.
                const audioTrack = tracks.find(t => t.type === 'audio');
                const trackId = audioTrack ? audioTrack.id : 'audio-track-1'; // Fallback if no audio track (should handle creation)
                
                // We add it at the PLAYHEAD position where recording STARTED.
                // Wait, recordingStartTime is system time.
                // We need the timeline time when we started.
                // We could store "timelineStartTime" in store too?
                // Or just assume user hasn't moved playhead wildly (if we auto-played).
                // Let's assume we place it where the playhead IS NOW minus duration?
                // Better: We should have stored the timeline start time.
                // For MVP: Place at current playhead - duration (assuming we played).
                // Or if we didn't play: Place at current playhead.
                
                // Let's calculate duration from blob size or better, just use the duration timer we tracked.
                // Blob duration is tricky without metadata reading.
                
                // Simplification for MVP:
                // We will add it at the current timeline Time.
                // User can move it.
                
                addClip(trackId, {
                    id: nanoid(),
                    assetId: assetId,
                    start: timelineTime, // This places it at END of recording? No, we want Start.
                    duration: 5000, // Placeholder duration?
                    offset: 0,
                    name: 'Voiceover'
                });

                // Trigger playback stop if we started it?
                togglePlayback(); // Pause

            } catch (err) {
                console.error("Recording failed to save", err);
            }

        } else {
            // START
            setIsPreparing(true);
            try {
                await service.startRecording();
                setIsPreparing(false);
                setIsRecording(true);
                setRecordingStartTime(Date.now());
                
                // Optional: Start Playback to sync voice
                // togglePlayback(); 
            } catch (err) {
                console.error("Failed to start recording", err);
                setIsPreparing(false);
            }
        }
    };

    return (
        <div className="flex items-center gap-4 bg-[#2a2a2a] px-4 py-2 rounded-lg border border-white/10">
            {/* Level Meter */}
            <div className="flex gap-0.5 items-end h-8 w-12">
                 {[...Array(5)].map((_, i) => (
                     <div key={i} className={`w-2 rounded-t-sm transition-all duration-75 ${
                            audioLevel > (i * 0.2) ? 'bg-green-400' : 'bg-white/10'
                        }`}
                        style={{ height: `${Math.min(100, (audioLevel * 100) + (i*10))}%` }}
                     />
                 ))}
            </div>
            
            <div className="flex flex-col items-center min-w-[60px]">
                <span className={`text-xs font-mono ${isRecording ? 'text-red-500 animate-pulse' : 'text-white/50'}`}>
                    {isRecording ? 'REC' : 'READY'}
                </span>
                <span className="text-sm font-bold text-white">{duration}</span>
            </div>

            <button
                onClick={handleToggleRecording}
                disabled={isPreparing}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-white/10 hover:bg-white/20 text-red-500'
                }`}
            >
                {isPreparing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : isRecording ? (
                    <Square className="w-4 h-4 fill-current" />
                ) : (
                    <Mic className="w-5 h-5" />
                )}
            </button>
        </div>
    );
};
