
import type { AudioPluginData } from "../types";

export class AudioEngine {
    private ac: AudioContext;
    private masterGain: GainNode;
    
    // Track Graph: TrackId -> { input: Gain, plugins: PluginNode[], volume: Gain, output: Gain }
    private tracks = new Map<string, AudioTrackGraph>();
    
    // Resource Management
    // For Video Elements, we need a MediaElementSourceNode.
    // Since we handle video elements in CompositionEngine, we might need a way to connect them here.
    // Or, AudioEngine manages the nodes but Input comes from external.


    constructor() {
        this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ac.createGain();
        this.masterGain.connect(this.ac.destination);
    }
    
    get currentTime() {
        return this.ac.currentTime;
    }

    async resume() {
        if (this.ac.state === 'suspended') {
            await this.ac.resume();
        }
    }
    
    // --- Track Management ---
    
    ensureTrack(trackId: string) {
        if (this.tracks.has(trackId)) return this.tracks.get(trackId)!;
        
        const input = this.ac.createGain();
        const panner = this.ac.createStereoPanner();
        const volume = this.ac.createGain();
        
        // Chain: Input -> Plugins -> Panner -> Volume -> Master
        input.connect(panner);
        panner.connect(volume);
        volume.connect(this.masterGain);
        
        const graph: AudioTrackGraph = {
            id: trackId,
            input,
            plugins: [],
            panner,
            volume,
            pluginChain: [input, panner, volume],
            baseVolume: 1.0,
            isMuted: false,
            isSoloed: false
        };
        
        this.tracks.set(trackId, graph);
        return graph;
    }
    
    updateTrackVolume(trackId: string, value: number) {
        const track = this.ensureTrack(trackId);
        track.baseVolume = value;
        this.updateMix();
    }

    updateTrackPan(trackId: string, value: number) {
        const track = this.ensureTrack(trackId);
        // clamp -1 to 1
        track.panner.pan.value = Math.max(-1, Math.min(1, value));
    }

    setTrackMute(trackId: string, muted: boolean) {
        const track = this.ensureTrack(trackId);
        track.isMuted = muted;
        this.updateMix();
    }

    setTrackSolo(trackId: string, soloed: boolean) {
        const track = this.ensureTrack(trackId);
        track.isSoloed = soloed;
        this.updateMix();
    }

    setMasterVolume(value: number) {
        this.masterGain.gain.value = value;
    }

    // Central Mixer Logic
    private updateMix() {
        const anySolo = Array.from(this.tracks.values()).some(t => t.isSoloed);

        this.tracks.forEach(track => {
            let effectiveGain = track.baseVolume;

            if (track.isMuted) {
                effectiveGain = 0;
            } else if (anySolo && !track.isSoloed) {
                effectiveGain = 0;
            }

            // Apply with smoothing to avoid clicks
            track.volume.gain.setTargetAtTime(effectiveGain, this.ac.currentTime, 0.02);
        });
    }
    
    // --- Plugin Management ---
    
    updateTrackPlugins(trackId: string, plugins: AudioPluginData[]) {
        const track = this.ensureTrack(trackId);
        
        // Brute force: Rebuild chain
        // Disconnect everything
        // 1. Disconnect Input
        track.input.disconnect();
        
        // 2. Disconnect existing plugins
        track.plugins.forEach(p => p.node.disconnect());
        
        // 3. Clear plugins
        track.plugins = [];
        
        // 4. Rebuild
        let currentNode: AudioNode = track.input;
        
        plugins.forEach(p => {
            if (!p.enabled) return;
            
            const node = this.createPluginNode(p);
            if (node) {
                currentNode.connect(node);
                currentNode = node;
                
                track.plugins.push({
                    data: p,
                    node: node
                });
            }
        });
        
        // 5. Connect to Panner (Rest of chain is consistent)
        currentNode.connect(track.panner);
    }
    
    private createPluginNode(p: AudioPluginData): AudioNode | null {
        switch (p.type) {
            case 'gain': {
                const node = this.ac.createGain();
                node.gain.value = p.parameters.gain ?? 1;
                return node;
            }
            case 'eq-3band': {
                // Simplified: Just 3 Peaking/Shelf filters in series?
                // Or wrapped in a Gain?
                // Web Audio doesn't have a "multi-out" node easily wrapped. 
                // We'll return the Input of the chain, but we need to return ONE node that connects to output.
                // Standard AudioNode implies single input/output for chain.
                // Wait, BiquadFilter is one node. 3 bands = 3 nodes. 
                // We need a composite node or handle chain manually.
                // For simplicity here, let's create 3 nodes and chain them, returning input and connecting last to next.
                // But this function returns ONE node.
                // Solution: Wrap in a conceptual Sub-Graph?
                // Hack: We return the FIRST node, but we must connect the LAST node to the outside.
                // This `createPluginNode` signature is insufficient for multi-node plugins.
                // Let's implement single-node plugins for now, or handle chaining inside.
                
                // Let's implement EQ as a LowShelf (Bass) for MVP since I can't return a graph easily without refactoring.
                // actually, I can just return the first node, and store the last node.
                // But let's stick to simple nodes.
                
                const node = this.ac.createBiquadFilter();
                node.type = 'peaking';
                node.frequency.value = 1000;
                node.gain.value = p.parameters.mid ?? 0;
                return node;
            }
            case 'delay': {
                const delay = this.ac.createDelay();
                delay.delayTime.value = p.parameters.time ?? 0.3;
                
                // Dry/Wet?
                // This requires a graph (Splitter -> Delay -> Gain -> Merger).
                // MVP: Just Insert Delay.
                return delay;
            }
            case 'compressor': {
                const comp = this.ac.createDynamicsCompressor();
                comp.threshold.value = p.parameters.threshold ?? -24;
                comp.ratio.value = p.parameters.ratio ?? 12;
                return comp;
            }
            default:
                return null;
        }
    }
    
    // --- Input Handling ---
    

    
    // We need a reliable way to get source node.
    private elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
    
    connectVideo(video: HTMLVideoElement, trackId: string) {
        let source = this.elementSources.get(video);
        if (!source) {
             try {
                source = this.ac.createMediaElementSource(video);
                this.elementSources.set(video, source);
             } catch(e) {
                 console.warn("AudioEngine: Failed to create source", e);
                 return;
             }
        }
        
        const track = this.ensureTrack(trackId);
        // Connect Source -> Track Input
        // Note: multiple sources can connect to track input.
        source.connect(track.input);
    }
}

interface AudioTrackGraph {
    id: string;
    input: GainNode;
    plugins: { data: AudioPluginData, node: AudioNode }[];
    panner: StereoPannerNode;
    volume: GainNode;
    pluginChain: AudioNode[];
    
    // Mixer State
    baseVolume: number; // The user-set volume (0-1+)
    isMuted: boolean;
    isSoloed: boolean;
}
