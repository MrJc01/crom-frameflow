import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Users, Wifi, Play, MonitorPlay } from 'lucide-react';
import { BroadcastService, type BroadcastState } from '../services/BroadcastService';
import { ariaButton, ariaDialog } from '../utils/a11y';
import { toast } from 'sonner';

interface CollaborationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CollaborationModal: React.FC<CollaborationModalProps> = ({ isOpen, onClose }) => {
    const [state, setState] = useState<BroadcastState>(BroadcastService.getState());
    const [joinId, setJoinId] = useState('');
    const [mode, setMode] = useState<'menu' | 'host' | 'join'>('menu');
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const unsub = BroadcastService.subscribe(setState);
        return unsub;
    }, [isOpen]);

    useEffect(() => {
        if (state.remoteStream && videoRef.current) {
            videoRef.current.srcObject = state.remoteStream;
            videoRef.current.play().catch(console.error);
        }
    }, [state.remoteStream]);

    // Cleanup when closing modal if not active? 
    // No, we might want to keep broadcast running in background.
    
    const handleStartHosting = async () => {
        try {
            const id = await BroadcastService.startHosting('main-viewport-canvas'); // Assuming ID from Viewport
            toast.success(`Broadcasting started! ID: ${id}`);
            setMode('host');
        } catch (e: any) {
            toast.error(`Failed to host: ${e.message}`);
        }
    };

    const handleJoin = async () => {
        if (!joinId) return;
        try {
            await BroadcastService.joinBroadcast(joinId);
            toast.success('Joining broadcast...');
            setMode('join');
        } catch (e: any) {
            toast.error(`Failed to join: ${e.message}`);
        }
    };

    const handleCopyId = () => {
        if (state.peerId) {
            navigator.clipboard.writeText(state.peerId);
            toast.success('ID copied to clipboard');
        }
    };

    const handleStop = () => {
        BroadcastService.stop();
        setMode('menu');
        toast.info('Session ended');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" {...ariaDialog('Collaboration')}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        Live Collaboration
                    </h2>
                    <button onClick={onClose} {...ariaButton('Close')} className="p-1 hover:bg-gray-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {mode === 'menu' && !state.isHosting && !state.isViewing && (
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={handleStartHosting}
                                className="flex flex-col items-center justify-center p-6 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg transition-all group"
                            >
                                <div className="p-3 bg-purple-500/20 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                    <Wifi className="w-8 h-8 text-purple-400" />
                                </div>
                                <span className="font-semibold">Start Broadcast</span>
                                <span className="text-xs text-gray-400 mt-1">Share your timeline</span>
                            </button>

                            <button 
                                onClick={() => setMode('join')}
                                className="flex flex-col items-center justify-center p-6 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg transition-all group"
                            >
                                <div className="p-3 bg-blue-500/20 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                    <MonitorPlay className="w-8 h-8 text-blue-400" />
                                </div>
                                <span className="font-semibold">Join Session</span>
                                <span className="text-xs text-gray-400 mt-1">Watch another editor</span>
                            </button>
                        </div>
                    )}

                    {(mode === 'host' || state.isHosting) && (
                        <div className="space-y-4">
                            <div className="bg-green-900/20 border border-green-800 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                    <div>
                                        <p className="font-medium text-green-400">Broadcasting Live</p>
                                        <p className="text-xs text-gray-400">{state.viewers} viewers connected</p>
                                    </div>
                                </div>
                                <button onClick={handleStop} className="px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-sm transition-colors">
                                    Stop
                                </button>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Session ID</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-black/30 p-2 rounded text-sm font-mono text-gray-300 truncate">
                                        {state.peerId || 'Generating...'}
                                    </code>
                                    <button onClick={handleCopyId} className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors" title="Copy ID">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {(mode === 'join' || state.isViewing) && (
                        <div className="space-y-4">
                            {!state.isViewing ? (
                                <>
                                    <div>
                                        <label className="text-sm text-gray-300 block mb-2">Enter Session ID</label>
                                        <input 
                                            type="text" 
                                            value={joinId}
                                            onChange={e => setJoinId(e.target.value)}
                                            placeholder="Paste ID here..."
                                            className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setMode('menu')} className="flex-1 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors">
                                            Back
                                        </button>
                                        <button onClick={handleJoin} disabled={!joinId} className="flex-1 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                            Connect
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                     <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-gray-800">
                                         <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted />
                                         <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white flex items-center gap-2">
                                             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                             Live Feed
                                         </div>
                                     </div>
                                     <button onClick={handleStop} className="w-full py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors">
                                         Disconnect
                                     </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
