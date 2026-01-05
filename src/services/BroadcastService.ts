import Peer, { type MediaConnection } from 'peerjs';

export interface BroadcastState {
    isHosting: boolean;
    isViewing: boolean;
    peerId: string | null;
    viewers: number;
    error: string | null;
    remoteStream: MediaStream | null;
}

type BroadcastListener = (state: BroadcastState) => void;

class BroadcastServiceClass {
    private peer: Peer | null = null;
    private connections: Map<string, MediaConnection> = new Map();
    private localStream: MediaStream | null = null;
    private state: BroadcastState = {
        isHosting: false,
        isViewing: false,
        peerId: null,
        viewers: 0,
        error: null,
        remoteStream: null
    };
    private listeners: Set<BroadcastListener> = new Set();

    /**
     * Start hosting the current canvas session
     */
    async startHosting(canvasId: string = 'main-canvas'): Promise<string> {
        this.reset();
        
        try {
            const canvas = document.querySelector(`#${canvasId}`) as HTMLCanvasElement;
            if (!canvas) throw new Error(`Canvas #${canvasId} not found`);

            // Capture stream (30FPS)
            this.localStream = canvas.captureStream(30);
            
            // Initialize Peer
            this.peer = new Peer();
            
            return new Promise((resolve, reject) => {
                this.peer!.on('open', (id) => {
                    this.updateState({ isHosting: true, peerId: id });
                    console.log(`[Broadcast] Hosting on ID: ${id}`);
                    resolve(id);
                });

                this.peer!.on('connection', (conn) => {
                    // Data connection (chat/sync later)
                    console.log(`[Broadcast] New data conn from ${conn.peer}`);
                });

                this.peer!.on('error', (err) => {
                    console.error('[Broadcast] Peer Error:', err);
                    this.updateState({ error: err.message });
                    reject(err);
                });

                // Handle incoming viewers
                this.peer!.on('call', (call) => {
                    console.log(`[Broadcast] Answer call from ${call.peer}`);
                    call.answer(this.localStream!);
                    this.connections.set(call.peer, call);
                    this.updateState({ viewers: this.connections.size });

                    call.on('close', () => {
                        this.connections.delete(call.peer);
                        this.updateState({ viewers: this.connections.size });
                    });
                });
            });

        } catch (e: any) {
            this.updateState({ error: e.message });
            throw e;
        }
    }

    /**
     * Join a broadcast as a viewer
     */
    async joinBroadcast(hostId: string): Promise<void> {
        this.reset();
        this.peer = new Peer();

        return new Promise((resolve, reject) => {
             this.peer!.on('open', (id) => {
                this.updateState({ isViewing: true, peerId: id });
                console.log(`[Broadcast] Joined as ${id}, calling ${hostId}`);
                
                // Call the host
                // We send a dummy stream or just receive? 
                // PeerJS require us to send a stream to answer? No, `call` initiates.
                // call(peerId, stream, options)
                // If we are just viewing, we might need a dummy stream or just expect one-way?
                // Standard WebRTC is usually bidirectional negotiation.
                // PeerJS `call` EXPECTS a stream to send usually? No, it's optional in some implementations but PeerJS types say MediaStream.
                // Use a dummy audio track if needed, or just standard capture.
                
                // Workaround: We ask the host to call us? Or we call host.
                // Usually Host calls viewers is "Broadcast".
                // But PeerJS simple model: Caller provides stream.
                // So HOST should wait for connections?
                // Actually, if Client calls Host, Client needs to send stream. 
                // But Client has nothing.
                // Let's use a dummy stream (black canvas) if needed, or check if null works.
                // Actually PeerJS docs: `peer.call(id, stream)`
                
                const dummyStream = this.createDummyStream();
                const call = this.peer!.call(hostId, dummyStream);

                call.on('stream', (remoteStream) => {
                    console.log('[Broadcast] Received remote stream');
                    this.updateState({ remoteStream });
                });
                
                call.on('error', (err) => {
                    console.error('[Broadcast] Call error', err);
                    this.updateState({ error: err.message });
                });

                resolve();
             });
             
             this.peer!.on('error', (err) => {
                 this.updateState({ error: err.message });
                 reject(err);
             });
        });
    }

    stop() {
        this.localStream?.getTracks().forEach(t => t.stop());
        this.connections.forEach(c => c.close());
        this.connections.clear();
        this.peer?.destroy();
        this.reset();
    }

    subscribe(listener: BroadcastListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }
    
    getState() {
        return this.state;
    }

    private updateState(partial: Partial<BroadcastState>) {
        this.state = { ...this.state, ...partial };
        this.listeners.forEach(l => l(this.state));
    }

    private reset() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.localStream = null;
        this.state = {
            isHosting: false,
            isViewing: false,
            peerId: null,
            viewers: 0,
            error: null,
            remoteStream: null
        };
        this.connections.clear();
        this.updateState({});
    }

    private createDummyStream(): MediaStream {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.captureStream(1);
    }
}

export const BroadcastService = new BroadcastServiceClass();
