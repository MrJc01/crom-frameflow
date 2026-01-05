export interface GPUCapabilities {
    isSupported: boolean;
    adapterInfo?: {
        vendor: string;
        architecture: string;
        device: string;
        description: string;
    };
    limits?: GPUSupportedLimits;
    features?: Set<string>; // GPUSupportedFeatures is array-like but not Array
    tier?: 'low' | 'medium' | 'high';
}

export class GPUProfiler {
    private static instance: GPUProfiler;
    private capabilities: GPUCapabilities = { isSupported: false };

    private constructor() {}

    static getInstance(): GPUProfiler {
        if (!GPUProfiler.instance) {
            GPUProfiler.instance = new GPUProfiler();
        }
        return GPUProfiler.instance;
    }

    async init(): Promise<GPUCapabilities> {
        if (!navigator.gpu) {
            this.capabilities = { isSupported: false };
            return this.capabilities;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                this.capabilities = { isSupported: false };
                return this.capabilities;
            }

            const info = await (adapter as any).requestAdapterInfo();
            
            // Extract features
            const features = new Set<string>();
            adapter.features.forEach((feature) => features.add(feature));

            this.capabilities = {
                isSupported: true,
                adapterInfo: {
                    vendor: info.vendor,
                    architecture: info.architecture,
                    device: info.device,
                    description: info.description
                },
                limits: adapter.limits,
                features: features,
                tier: this.estimateTier(adapter)
            };

        } catch (e) {
            console.error("GPU Profiler Error:", e);
            this.capabilities = { isSupported: false };
        }

        return this.capabilities;
    }

    getCapabilities(): GPUCapabilities {
        return this.capabilities;
    }

    private estimateTier(adapter: GPUAdapter): 'low' | 'medium' | 'high' {
        // Simple heuristic based on texture limits
        const maxTexture = adapter.limits.maxTextureDimension2D;
        if (maxTexture >= 16384) return 'high';
        if (maxTexture >= 8192) return 'medium';
        return 'low';
    }
}
