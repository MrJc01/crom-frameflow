import * as ort from 'onnxruntime-web';

// Singleton service to manage AI Segmentation
export class AISegmentationService {
    private static instance: AISegmentationService;
    private session: ort.InferenceSession | null = null;
    private isLoading = false;

    private constructor() {
        // Configure ONNX Runtime to use WebGPU if available, or WASM
        // ort.env.wasm.wasmPaths = "/"; // Adjust if needed
    }

    static getInstance(): AISegmentationService {
        if (!AISegmentationService.instance) {
            AISegmentationService.instance = new AISegmentationService();
        }
        return AISegmentationService.instance;
    }

    async loadModel(modelUrl: string = 'https://raw.githubusercontent.com/pollinations/modnet-onnx/main/modnet.onnx'): Promise<boolean> {
        if (this.session) return true;
        if (this.isLoading) return false;

        this.isLoading = true;
        try {
            console.log("Loading AI Model...", modelUrl);
            // Hint: ModNet is commonly used for portrait matting
            // We need to ensure the URL is valid and CORS allowed.
            // For now we use a placeholder or specific known URL.
            
            // Note: Creating session might be heavy.
            // We try to use WebGPU backend if possible, else WASM.
            /*
            const options: ort.InferenceSession.SessionOptions = {
                executionProviders: ['webgpu', 'wasm'],
            };
            */
           // Fallback to defaults for broader compatibility first
            this.session = await ort.InferenceSession.create(modelUrl);
            console.log("AI Model Loaded Successfully");
            return true;
        } catch (e) {
            console.error("Failed to load AI Model", e);
            return false;
        } finally {
            this.isLoading = false;
        }
    }

    async predict(image: ImageBitmap | HTMLImageElement | HTMLVideoElement | VideoFrame): Promise<ImageBitmap | null> {
        if (!this.session) return null;

        try {
            // 1. Preprocess: Resize to model input (e.g. 512x512 for ModNet) and normalize
            // This is the expensive part in JS. Ideally use WebGPU for resize.
            // For this MVP, we will use a canvas to resize.
            
            const offscreen = new OffscreenCanvas(512, 512);
            const ctx = offscreen.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(image, 0, 0, 512, 512);
            const imageData = ctx.getImageData(0, 0, 512, 512);
            
            // 2. Prepare Tensor
            // ModNet expects NCHW float32 [1, 3, 512, 512] normally, depends on export.
            // Assuming standard [1, 3, 512, 512] with RGB normalized.
            // Note: This data manipulation is SLOW in JS.
            const { data, width, height } = imageData;
            const floatData = new Float32Array(1 * 3 * width * height);
            
            for (let i = 0; i < width * height; i++) {
                // Normalize 0-255 to -1 to 1 or 0 to 1 depending on model.
                // ModNet usually wants (x - 127.5) / 127.5
                floatData[i] = (data[i * 4] - 127.5) / 127.5; // R
                floatData[width*height + i] = (data[i * 4 + 1] - 127.5) / 127.5; // G
                floatData[2*width*height + i] = (data[i * 4 + 2] - 127.5) / 127.5; // B
            }
            
            const inputTensor = new ort.Tensor('float32', floatData, [1, 3, width, height]);

            // 3. Run Inference
            const feeds = { input: inputTensor }; // Input name depends on model! Check model via Netron.
            // Typically 'input' or 'input_1'
            // We might need to try/catch input names.
            
            const results = await this.session.run(feeds);
            
            // 4. Output
            // Usually 'output' [1, 1, 512, 512] -> Alpha matte
            const output = results[Object.keys(results)[0]]; // Grab first output
            
            // 5. Postprocess: Create ImageBitmap from mask
            const outputData = output.data as Float32Array;
            const maskImageData = new ImageData(512, 512); // Use Offscreen logic
            
            for (let i = 0; i < outputData.length; i++) {
                const val = outputData[i]; // 0 to 1 alpha
                // We want a greyscale mask or just Alpha?
                // Visualizing: White = Foreground, Black = Background.
                const alpha = Math.max(0, Math.min(255, val * 255));
                maskImageData.data[i * 4] = 255;
                maskImageData.data[i * 4 + 1] = 255;
                maskImageData.data[i * 4 + 2] = 255;
                maskImageData.data[i * 4 + 3] = alpha;
            }
            
            ctx.putImageData(maskImageData, 0, 0);
            return await offscreen.transferToImageBitmap();

        } catch (e) {
            console.error("Inference Failed", e);
            return null;
        }
    }
}
