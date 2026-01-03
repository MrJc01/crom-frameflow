import React, { useEffect } from 'react';
import { Viewport } from './Viewport';
import { useAppStore } from '../stores/useAppStore';

export const PresentationWindow: React.FC = () => {
    // Receiver Logic
    useEffect(() => {
        const channel = new BroadcastChannel('frameflow_sync');

        const handleMessage = (event: MessageEvent) => {
             const data = event.data;
             if (data && data.type === 'STATE_UPDATE') {
                 useAppStore.setState(data.payload);
             }
        };

        channel.onmessage = handleMessage;

        // Request initial state on mount
        channel.postMessage({ type: 'REQUEST_INIT' });

        return () => {
            channel.close();
        };
    }, []);

    return (
        <div className="w-screen h-screen bg-black overflow-hidden relative">
            <Viewport />
            {/* Optional: Add a small "Presentation Mode" indicator that fades out */}
            <div className="absolute top-4 right-4 bg-black/50 text-white/30 text-xs px-2 py-1 rounded pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                Presenting
            </div>
        </div>
    );
};
