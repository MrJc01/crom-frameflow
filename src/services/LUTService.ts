export interface LUTData {
    size: number;
    data: Float32Array;
}

export class LUTService {
    /**
     * Parses a standard Adobe .cube file string.
     * Supports LUT_3D_SIZE keyword and data points.
     * Ignores comments (#) and irrelevant headers.
     */
    static parseCube(content: string): LUTData {
        const lines = content.split(/\r?\n/);
        let size = 0;
        let data: Float32Array | null = null;
        let dataIndex = 0;

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('LUT_3D_SIZE')) {
                const parts = line.split(/\s+/);
                size = parseInt(parts[1], 10);
                const totalPoints = size * size * size;
                data = new Float32Array(totalPoints * 4); // RGBA (WebGPU textures usually need 4 channels or alignment)
                continue;
            }

            if (line.startsWith('TITLE') || line.startsWith('DOMAIN_')) continue;

            // Data Lines: R G B
            if (size > 0 && data) {
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    const r = parseFloat(parts[0]);
                    const g = parseFloat(parts[1]);
                    const b = parseFloat(parts[2]);
                    
                    if (!isNaN(r)) {
                        data[dataIndex * 4 + 0] = r;
                        data[dataIndex * 4 + 1] = g;
                        data[dataIndex * 4 + 2] = b;
                        data[dataIndex * 4 + 3] = 1.0; // Alpha
                        dataIndex++;
                    }
                }
            }
        }

        if (!data || size === 0) {
            throw new Error("Invalid .cube file: size or data missing");
        }

        return { size, data };
    }

    /**
     * Tries to parse using WASM if available, falls back to JS.
     */
    static async parseCubeAsync(content: string): Promise<LUTData> {
        try {
            // Dynamic import to avoid bundling issues if WASM is missing
            // @ts-ignore
            const wasm = await import('../../../src-wasm/pkg/frameflow_wasm.js');
            await wasm.default(); // Initialize WASM
            
            const raw = wasm.parse_cube(content);
            const size = raw.size as number;
            const data = raw.data as Float32Array; // wasm-bindgen returns TypedArray view or copy?
            // If it returns a View, we must slice it because memory might grow.
            // Our Rust getter returns `Vec<f32>` which wasm-bindgen converts to `Float32Array` copy for us usually.
            
            return { size, data };
        } catch (e) {
            console.warn("WASM LUT parse failed, falling back to JS", e);
            return this.parseCube(content);
        }
    }

    /**
     * Creates an Identity LUT of a given size.
     */
    static createIdentityLUT(size = 33): LUTData {
        const data = new Float32Array(size * size * size * 4);
        const step = 1.0 / (size - 1);
        
        let index = 0;
        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    data[index * 4 + 0] = x * step;
                    data[index * 4 + 1] = y * step;
                    data[index * 4 + 2] = z * step;
                    data[index * 4 + 3] = 1.0;
                    index++;
                }
            }
        }
        return { size, data };
    }
}
