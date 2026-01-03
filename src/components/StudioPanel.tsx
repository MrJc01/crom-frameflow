import React, { useEffect, useState } from 'react';
import { Square, Mic, Settings, Clapperboard } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { db } from '../db/FrameFlowDB';

export const StudioPanel: React.FC = () => {
    const isRecording = useAppStore(state => state.isRecording);
    const recordingStartTime = useAppStore(state => state.recordingStartTime);
    const setIsRecording = useAppStore(state => state.setIsRecording);
    const setRecordingStartTime = useAppStore(state => state.setRecordingStartTime);

    const [elapsed, setElapsed] = useState("00:00");

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
        if (!engine) {
            console.error("FrameFlow Engine not found");
            return;
        }

        if (isRecording) {
            // STOP
            try {
                const blob = await engine.stopRecording();
                setIsRecording(false);
                setRecordingStartTime(null);

                // Save to DB
                // We create a File object from the blob to reuse addAsset logic
                const fileName = `Rec_${new Date().toLocaleString().replace(/[:/]/g, '-')}.webm`;
                const file = new File([blob], fileName, { type: 'video/webm' });
                
                await db.addAsset(file);
                
                // Maybe notify "Saved"?
                console.log("Recording saved to Asset Library");
                
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

    return (
        <div className="h-16 bg-[#0a0a0a] border-t border-white/10 flex items-center justify-between px-6 z-50">
            {/* Left: Status / Time */}
            <div className="flex items-center gap-4 w-1/3">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></div>
                    <span className="font-mono text-xl font-bold tracking-widest text-white/90">{elapsed}</span>
                </div>
                {isRecording && <span className="text-[10px] text-red-500 uppercase font-bold tracking-wider">REC</span>}
            </div>

            {/* Center: Controls */}
            <div className="flex items-center justify-center gap-4 w-1/3">
               
               {/* Record Button */}
               <button 
                  onClick={handleToggleRecord}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isRecording 
                      ? 'bg-white/10 hover:bg-white/20' 
                      : 'bg-red-600 hover:bg-red-500 hover:scale-110 shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                  }`}
               >
                   {isRecording ? (
                       <Square className="w-5 h-5 fill-white text-white" />
                   ) : (
                       <div className="w-4 h-4 rounded-sm bg-white" style={{borderRadius: '2px'}}></div>
                   )}
               </button>

            </div>

            {/* Right: Options */}
            <div className="flex items-center justify-end gap-3 w-1/3">
                <div className="flex bg-white/5 rounded-lg p-1">
                     <button className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white" title="Mic Settings">
                         <Mic className="w-4 h-4" />
                     </button>
                     <button className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white" title="Stream Settings">
                         <Settings className="w-4 h-4" />
                     </button>
                     <button className="p-2 hover:bg-white/5 rounded text-gray-400 hover:text-white" title="View Recordings">
                         <Clapperboard className="w-4 h-4" />
                     </button>
                </div>
            </div>
        </div>
    );
};
