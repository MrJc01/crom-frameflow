import { basicShader } from './shaders/basic.wgsl';
import { mixShader } from './shaders/mix.wgsl';
import { equirectShader } from './shaders/equirect.wgsl'; // Implicit import?

export interface RenderLayer {
    texture: VideoFrame | ImageBitmap;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    rotation: number; // radians
    scale: number;
    zIndex: number;
    chromaKey?: {
        enabled: boolean;
        color: [number, number, number]; // RGB 0-1
        similarity: number;
        smoothness: number;
    };
    text3d?: {
        enabled: boolean;
        depth: number;
        color: string;
    };
    mask?: ImageBitmap | HTMLCanvasElement; // Added mask
    lut?: GPUTexture; // Added LUT 3D Texture
    projection?: 'flat' | 'equirectangular';
    viewParams?: { yaw: number; pitch: number; fov: number };
}

export interface TransitionLayer extends Omit<RenderLayer, 'texture' | 'opacity' | 'zIndex' | 'chromaKey' | 'text3d' | 'mask'> {
    textureA: VideoFrame | ImageBitmap;
    textureB: VideoFrame | ImageBitmap;
    progress: number; // 0 to 1
    opacity: number;
    zIndex: number;
}

export class WebGPURenderer {
    private adapter: GPUAdapter | null = null;
    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    
    // Pipelines
    private pipeline: GPURenderPipeline | null = null;
    private transitionPipeline: GPURenderPipeline | null = null;
    private equirectPipeline: GPURenderPipeline | null = null;
    
    private sampler: GPUSampler | null = null;
    
    // Cache for uniforms
    private uniformBuffer: GPUBuffer | null = null;
    private transitionUniformBuffer: GPUBuffer | null = null; 
    private equirectUniformBuffer: GPUBuffer | null = null;
    
    // Quad Buffers
    private vertexBuffer: GPUBuffer | null = null;
    
    // Default Mask (White 1x1)
    private defaultMaskTexture: GPUTexture | null = null;
    // Default LUT (Identity)
    private defaultLUTTexture: GPUTexture | null = null;

    public isInitialized = false;

    constructor() {}

    async init(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<boolean> {
        if (!navigator.gpu) {
            console.warn("WebGPU not supported on this browser.");
            return false;
        }

        try {
            this.adapter = await navigator.gpu.requestAdapter();
            if (!this.adapter) {
                console.warn("No appropriate GPUAdapter found.");
                return false;
            }

            this.device = await this.adapter.requestDevice();
            
            this.context = canvas.getContext('webgpu') as GPUCanvasContext;
            
            if (!this.context) {
                console.warn("Failed to get WebGPU context.");
                return false;
            }

            // Configure Context
            const format = navigator.gpu.getPreferredCanvasFormat();
            this.context.configure({
                device: this.device,
                format: format,
                alphaMode: 'premultiplied',
            });

            await this.initDefaultMask(); // Init default mask
            await this.initPipelines(format);
            this.initBuffers();

            this.isInitialized = true;
            console.log("WebGPU Initialized Successfully");
            return true;
        } catch (e) {
            console.error("WebGPU Init Failed:", e);
            return false;
        }
    }

    async waitForQueue(): Promise<void> {
        if (this.device) {
             await this.device.queue.onSubmittedWorkDone();
        }
    }
    
    private async initDefaultMask() {
        if (!this.device) return;
        this.defaultMaskTexture = this.device.createTexture({
            size: [1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        
        // Write white pixel (255, 255, 255, 255)
        const data = new Uint8Array([255, 255, 255, 255]);
        this.device.queue.writeTexture(
            { texture: this.defaultMaskTexture },
            data,
            { bytesPerRow: 4, rowsPerImage: 1 },
            [1, 1]
        );

        await this.initDefaultLUT();
    }

    private async initDefaultLUT() {
        if (!this.device) return;
        // Create tiny identity LUT (2x2x2)
        const size = 2;
        const data = new Float32Array(size * size * size * 4);
        let i = 0;
        for(let z=0; z<size; z++) {
            for(let y=0; y<size; y++) {
                for(let x=0; x<size; x++) {
                    data[i++] = x / (size-1);
                    data[i++] = y / (size-1);
                    data[i++] = z / (size-1);
                    data[i++] = 1.0;
                }
            }
        }
        
        this.defaultLUTTexture = this.device.createTexture({
            size: [size, size, size],
            dimension: '3d',
            format: 'rgba32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        this.device.queue.writeTexture(
            { texture: this.defaultLUTTexture },
            data as any,
            { bytesPerRow: size * 16, rowsPerImage: size },
            [size, size, size]
        );
    }

    createLUTTexture(data: Float32Array, size: number): GPUTexture | null {
        if (!this.device) return null;
        try {
            const texture = this.device.createTexture({
                size: [size, size, size],
                dimension: '3d',
                format: 'rgba32float',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            });
            this.device.queue.writeTexture(
                { texture },
                data as any,
                { bytesPerRow: size * 16, rowsPerImage: size },
                [size, size, size]
            );
            return texture;
        } catch(e) { console.error("Failed to create LUT", e); return null; }
    }

    private async initPipelines(format: GPUTextureFormat) {
        if (!this.device) return;

        // 1. Basic Pipeline
        const shaderModule = this.device.createShaderModule({ code: basicShader });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} }, // Mask Binding
                { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '3d' } }, // LUT Binding
            ]
        });

        const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'main_vs',
                buffers: [{
                    arrayStride: 16, 
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' }, // Position
                        { shaderLocation: 1, offset: 8, format: 'float32x2' }, // UV
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'main_fs',
                targets: [{
                    format: format,
                    blend: {
                        color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-list' }
        });

        // 2. Transition Pipeline (Unchanged for now)
        const mixShaderModule = this.device.createShaderModule({ code: mixShader });
        const mixBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} }, // Tex A
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} }, // Tex B
            ]
        });

        const mixPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [mixBindGroupLayout] });

        this.transitionPipeline = this.device.createRenderPipeline({
            layout: mixPipelineLayout,
            vertex: {
                module: mixShaderModule,
                entryPoint: 'main_vs', 
                buffers: [{
                    arrayStride: 16, 
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x2' }, 
                        { shaderLocation: 1, offset: 8, format: 'float32x2' }, 
                    ]
                }]
            },
            fragment: {
                module: mixShaderModule,
                entryPoint: 'main_fs',
                targets: [{
                    format: format,
                    blend: {
                        color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-list' }
        });

        // 3. Equirectangular Pipeline
        const equirectModule = this.device.createShaderModule({ code: equirectShader });
        const equirectBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            ]
        });
        const equirectPipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [equirectBindGroupLayout] });
        this.equirectPipeline = this.device.createRenderPipeline({
            layout: equirectPipelineLayout,
            vertex: {
                module: equirectModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: equirectModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: format,
                    blend: {
                        color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-list' }
        });

        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
    }

    private initBuffers() {
        if (!this.device) return;

        // Quad data
        const vertices = new Float32Array([
             -0.5,  0.5,        0, 0, 
             -0.5, -0.5,        0, 1, 
              0.5, -0.5,        1, 1, 
             
             -0.5,  0.5,        0, 0, 
              0.5, -0.5,        1, 1, 
              0.5,  0.5,        1, 0, 
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        // @ts-ignore
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices as any);
        
        // Basic Uniform Buffer (112 bytes)
        this.uniformBuffer = this.device.createBuffer({
            size: 112, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Transition Uniform Buffer
        // Mat4x4 (64) + Opacity (4) + Ratio (4) + Padding (8) = 80
        this.transitionUniformBuffer = this.device.createBuffer({
            size: 80, 
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    render(layers: (RenderLayer | TransitionLayer)[]) {
        if (!this.isInitialized || !this.device || !this.context || !this.pipeline || !this.transitionPipeline || !this.vertexBuffer || !this.sampler || !this.uniformBuffer || !this.transitionUniformBuffer || !this.defaultMaskTexture || !this.defaultLUTTexture) return;

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);

        const canvasWidth = this.context.canvas.width;
        const canvasHeight = this.context.canvas.height;

        for (const layer of layers) {
             if (this.isTransitionLayer(layer)) {
                 // --- Draw Transition ---
                 passEncoder.setPipeline(this.transitionPipeline);
                 
                 // 1. Upload Textures
                 let texA: GPUTexture | null = null;
                 let texB: GPUTexture | null = null;
                 
                 try {
                     // @ts-ignore
                    texA = this.device.importExternalTexture({ source: layer.textureA });
                     // @ts-ignore
                    texB = this.device.importExternalTexture({ source: layer.textureB });
                 } catch (e) { continue; }
                 
                 if (!texA || !texB) continue;

                 // 2. Uniforms
                 const matrix = this.computeMatrix(layer, canvasWidth, canvasHeight);
                 const uniformData = new Float32Array([layer.opacity, layer.progress]); // 2 floats
                 
                 this.device.queue.writeBuffer(this.transitionUniformBuffer, 0, matrix as any);
                 // @ts-ignore
                 this.device.queue.writeBuffer(this.transitionUniformBuffer, 64, uniformData as any);
                 
                 // 3. Bind Group
                 const bindGroup = this.device.createBindGroup({
                     layout: this.transitionPipeline.getBindGroupLayout(0),
                     entries: [
                         { binding: 0, resource: { buffer: this.transitionUniformBuffer } },
                         { binding: 1, resource: this.sampler },
                         { binding: 2, resource: texA },
                         { binding: 3, resource: texB }
                     ]
                 });

                 passEncoder.setBindGroup(0, bindGroup);
                 passEncoder.draw(6);

             } else if (layer.projection === 'equirectangular' && this.equirectPipeline && this.equirectUniformBuffer) {
                 // --- Draw 360/Equirectangular ---
                 passEncoder.setPipeline(this.equirectPipeline);

                 // Uniforms
                 const params = layer.viewParams || { yaw: 0, pitch: 0, fov: 90 };
                 const rad = (deg: number) => deg * Math.PI / 180;
                 const uniformData = new Float32Array([
                     rad(params.yaw), 
                     rad(params.pitch), 
                     rad(params.fov), 
                     rad(params.fov), 
                     canvasWidth / canvasHeight 
                 ]);
                 this.device.queue.writeBuffer(this.equirectUniformBuffer, 0, uniformData as any);

                 // Texture
                 let texture: GPUTexture | null = null;
                 try {
                    // @ts-ignore
                    texture = this.device.importExternalTexture({ source: layer.texture });
                 } catch (e) { continue; }
                 
                 if (!texture) continue;

                 const bindGroup = this.device.createBindGroup({
                     layout: this.equirectPipeline.getBindGroupLayout(0),
                     entries: [
                         { binding: 0, resource: this.sampler },
                         { binding: 1, resource: texture },
                         { binding: 2, resource: { buffer: this.equirectUniformBuffer } }
                     ]
                 });
                 
                 passEncoder.setBindGroup(0, bindGroup);
                 passEncoder.draw(6);

             } else {
                 // --- Draw Standard Layer ---
                 passEncoder.setPipeline(this.pipeline);

                 let texture: GPUTexture | null = null;
                 let maskTexture: GPUTexture | null = null;

                 try {
                    // @ts-ignore
                    texture = this.device.importExternalTexture({ source: layer.texture });
                    
                    if (layer.mask) {
                         // @ts-ignore
                         maskTexture = this.device.importExternalTexture({ source: layer.mask });
                    }
                 } catch (e) { continue; }

                 if (!texture) continue;
                 
                 // Fallback to default white mask if none provided
                 const finalMask = maskTexture || this.defaultMaskTexture;

                 const matrix = this.computeMatrix(layer, canvasWidth, canvasHeight);
                 
                 this.device.queue.writeBuffer(this.uniformBuffer, 0, matrix as any);
                 
                 const chroma = layer.chromaKey || { enabled: false, color: [0, 1, 0], similarity: 0.4, smoothness: 0.1 };
                 const text3d = layer.text3d || { enabled: false, depth: 0, color: '#000000' };

                 const params = new Float32Array([
                     chroma.color[0], chroma.color[1], chroma.color[2], // 64, 68, 72
                     layer.opacity,                                      // 76
                     chroma.similarity,                                  // 80
                     chroma.smoothness,                                  // 84
                     chroma.enabled ? 1.0 : 0.0,                         // 88
                     text3d.depth,                                       // 92
                     text3d.enabled ? 1.0 : 0.0                          // 96
                 ]);

                 // @ts-ignore
                 this.device.queue.writeBuffer(this.uniformBuffer, 64, params as any);

                 const bindGroup = this.device.createBindGroup({
                     layout: this.pipeline.getBindGroupLayout(0),
                     entries: [
                         { binding: 0, resource: { buffer: this.uniformBuffer } },
                         { binding: 1, resource: this.sampler },
                         { binding: 2, resource: texture },
                         { binding: 3, resource: finalMask },
                         { binding: 4, resource: layer.lut ? layer.lut.createView() : this.defaultLUTTexture!.createView() }
                     ]
                 });
                 
                 passEncoder.setBindGroup(0, bindGroup);
                 
                 const instanceCount = text3d.enabled ? Math.max(1, Math.floor(text3d.depth)) : 1;
                 passEncoder.draw(6, instanceCount);
             }
        }

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    private isTransitionLayer(layer: any): layer is TransitionLayer {
        return 'textureA' in layer && 'textureB' in layer;
    }
    
    async getPixelData(): Promise<Uint8ClampedArray | null> {
        if (!this.device || !this.context) return null;

        const texture = this.context.getCurrentTexture();
        const width = texture.width;
        const height = texture.height;
        
        // Align to 256 bytes (WebGPU requirement)
        const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
        const bufferSize = bytesPerRow * height;

        const buffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
            { texture },
            { buffer, bytesPerRow },
            [width, height]
        );

        this.device.queue.submit([commandEncoder.finish()]);

        await buffer.mapAsync(GPUMapMode.READ);
        const copyArrayBuffer = buffer.getMappedRange();
        const data = new Uint8Array(copyArrayBuffer);
        
        // Remove padding if necessary
        // Return Uint8ClampedArray (RGBA)
        // If bytesPerRow == width * 4, we can just copy.
        // Else we need to unpad.
        
        const result = new Uint8ClampedArray(width * height * 4);
        
        if (bytesPerRow === width * 4) {
             result.set(data);
        } else {
             for (let y = 0; y < height; y++) {
                 const rowSize = width * 4;
                 const offset = y * bytesPerRow;
                 const row = data.subarray(offset, offset + rowSize);
                 result.set(row, y * rowSize);
             }
        }
        
        buffer.unmap();
        buffer.destroy();
        return result;
    }

    private computeMatrix(layer: Omit<RenderLayer, 'texture'>, canvasW: number, canvasH: number): Float32Array {
        // Create Projection (Ortho) * Model matrix
        // 2D Projection: 0,0 is center in WebGPU? Yes (-1 to 1).
        // But our Layer X,Y is top-left in pixels? Yes.
        
        // 1. Normalize Scale: layer.width / canvasW
        // 2. Normalize Position: Convert px to NDC
        
        const ndcX = ((layer.x + layer.width / 2) / canvasW) * 2 - 1;
        const ndcY = -(((layer.y + layer.height / 2) / canvasH) * 2 - 1); // Flip Y
        
        const scaleX = layer.width / canvasW * 2;
        const scaleY = layer.height / canvasH * 2;
        
        // Simple Matrix: Translate, then Scale, then Rotate
        // WebGPU uses column-major matrices
        
        // For MVP, lets use a minimal 2D matrix helper locally
        // Or just direct array manipulation
        
        const cos = Math.cos(layer.rotation);
        const sin = Math.sin(layer.rotation);
        
        // Model Matrix (Scale * Rotate * Translate)
        // We actually want: Translate * Rotate * Scale * Vertex
        // Because vertex is -0.5 to 0.5
        
        // Row-major logic for understanding:
        // [Sx*cos  -Sy*sin  0  Tx]
        // [Sx*sin   Sy*cos  0  Ty]
        
        // Actually, let's use a standard library usually, but here manual:
        
        // Matrix 4x4
        const m = new Float32Array(16);
        
        // Column 0
        m[0] = scaleX * cos;
        m[1] = scaleX * -sin; // Inverted Y?
        m[2] = 0;
        m[3] = 0;
        
        // Column 1
        m[4] = scaleY * sin; 
        m[5] = scaleY * cos; 
        m[6] = 0;
        m[7] = 0;
        
        // Column 2
        m[8] = 0;
        m[9] = 0;
        m[10] = 1;
        m[11] = 0;
        
        // Column 3 (Position)
        m[12] = ndcX;
        m[13] = ndcY;
        m[14] = 0;
        m[15] = 1;
        
        return m;
    }
}
