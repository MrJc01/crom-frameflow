export const basicShader = `
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) uv : vec2<f32>,
  @location(1) instanceIndex : u32,
}

struct Uniforms {
  transform : mat4x4<f32>,      // 64 bytes
  keyColor : vec3<f32>,         // 12 bytes
  opacity : f32,                // 4 bytes (Total 80)
  similarity : f32,             // 4 bytes
  smoothness : f32,             // 4 bytes
  useChromaKey : f32,           // 4 bytes (Total 92)
  extrusionDepth : f32,         // 4 bytes (Total 96) -- Reused padding? No, need to increase size
  // We need to keep 16-bye alignment for the struct overall usually?
  // Previous size was 96.
  // extending...
  // extrusionDepth : f32
  // is3D : f32
  // padding2 : f32
  // padding3 : f32
  // Total 112 bytes
}

// Re-defining Uniforms carefully
// 0-64: Transform
// 64-80: KeyColor(12) + Opacity(4) -> OK 16 bytes
// 80-96: Similarity(4) + Smoothness(4) + UseChromaKey(4) + ExtrusionDepth(4) -> OK 16 bytes
// 96-112: Is3D(4) + Padding(12) -> OK 16 bytes

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var mySampler : sampler;
@group(0) @binding(2) var myTexture : texture_2d<f32>;
@group(0) @binding(3) var myMask : texture_2d<f32>; // Binding 3
@group(0) @binding(4) var myLUT : texture_3d<f32>; // Binding 4 (LUT)

@vertex
fn main_vs(@location(0) position : vec2<f32>, @location(1) uv : vec2<f32>, @builtin(instance_index) instanceIdx : u32) -> VertexOutput {
  var output : VertexOutput;
  
  // 3D Extrusion Logic
  // We stack instances behind the "main" one (index 0).
  // Or current one is top?
  // Let's say index 0 is TOP. index N is Bottom.
  // Shift X/Y based on instance index to create depth direction.
  // Direction: (-1, 1) usually looks good for "Drop Shadow"
  
  var pos = position;
  
  if (uniforms.is3D > 0.5) {
      // Scale depth by step size (e.g. 1px per instance)
      let stepSize = 0.002; // Normalized space step
      let invIndex = uniforms.extrusionDepth - f32(instanceIdx);
      let offset = vec2<f32>(stepSize, -stepSize) * invIndex;
      pos = pos + offset;
  }
  
  output.Position = uniforms.transform * vec4<f32>(pos, 0.0, 1.0);
  output.uv = uv;
  output.instanceIndex = instanceIdx; // Pass to fragment
  return output;
}

@fragment
fn main_fs(@location(0) uv : vec2<f32>, @location(1) instanceIdx : u32) -> @location(0) vec4<f32> {
  var color = textureSample(myTexture, mySampler, uv);
  var mask = textureSample(myMask, mySampler, uv);
  var finalAlpha = color.a * uniforms.opacity * mask.r;

  // Chroma Key Logic
  if (uniforms.useChromaKey > 0.5) {
      let dist = distance(color.rgb, uniforms.keyColor);
      let baseMask = dist - uniforms.similarity;
      let fullMask = smoothstep(0.0, uniforms.smoothness, baseMask);
      finalAlpha *= fullMask;
  }
  
  // 3D Dimming
  if (uniforms.is3D > 0.5) {
     if (f32(instanceIdx) < (uniforms.extrusionDepth - 1.0)) {
         color = vec4<f32>(color.rgb * 0.6, color.a); 
     }
  }

  // LUT Application
  // Check if LUT texture is valid? We can't easily. 
  // We assume if a valid texture is bound, we use it?
  // Or we need a Uniform "useLUT".
  // For now, let's assume we ALWAYS bind a texture (even if identity).
  // Sampling 3D Texture using RGB as coordinates
  
  // To avoid artifacts at edges, we should clamp or scale? 
  // Standard LUT samplers usually handle 0-1 range directly.
  
  let lutColor = textureSample(myLUT, mySampler, color.rgb);
  
  // Only apply if alpha is high enough?
  // Usually we apply LUT to the color, then apply alpha.
  
  // We need a uniform to enable/disable LUT?
  // Let's assume we ALWAYS apply LUT if the shader is this version. 
  // If no LUT desired, we bind Identity LUT.
  
  // Mix based on something? 
  // Just return LUT color.
  
  return vec4<f32>(lutColor.rgb, finalAlpha);
}
`;
