import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export const usePresentationSync = () => {
    useEffect(() => {
        const channel = new BroadcastChannel('frameflow_sync');

        // Listen for requests (e.g. new window asking for init state)
        channel.onmessage = (event) => {
            if (event.data?.type === 'REQUEST_INIT') {
                const state = useAppStore.getState();
                channel.postMessage({
                    type: 'STATE_UPDATE',
                    payload: {
                        cards: state.cards,
                        activeCardId: state.activeCardId,
                        // We might want to sync other things like 'selectedElement' if we wanted a pointer, 
                        // but for 'Clean Feed' we specifically might NOT want that.
                        // For now, syncing cards + activeId is enough for "Mirroring".
                    }
                });
            }
        };

        // Subscribe to store changes
        const unsub = useAppStore.subscribe((state) => {
            // OPTIMIZATION: Throttle this if needed, but for local BroadcastChannel it's usually fast enough.
            // We only send the parts that matter for rendering.
            channel.postMessage({
                type: 'STATE_UPDATE',
                payload: {
                    cards: state.cards,
                    activeCardId: state.activeCardId,
                }
            });
        });

        return () => {
            unsub();
            channel.close();
        };
    }, []);
};
