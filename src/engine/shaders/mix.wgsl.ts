export const mixShader = `
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) uv : vec2<f32>,
}

struct Uniforms {
  transform : mat4x4<f32>,
  opacity : f32, // Overall opacity
  ratio : f32,   // Mix ratio (0.0 = Texture A, 1.0 = Texture B)
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var mySampler : sampler;
@group(0) @binding(2) var textureA : texture_2d<f32>;
@group(0) @binding(3) var textureB : texture_2d<f32>;

@vertex
fn main_vs(@location(0) position : vec2<f32>, @location(1) uv : vec2<f32>) -> VertexOutput {
  var output : VertexOutput;
  output.Position = uniforms.transform * vec4<f32>(position, 0.0, 1.0);
  output.uv = uv;
  return output;
}

@fragment
fn main_fs(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
  var colorA = textureSample(textureA, mySampler, uv);
  var colorB = textureSample(textureB, mySampler, uv);
  
  // Simple Cross Dissolve
  var mixedColor = mix(colorA, colorB, uniforms.ratio);
  
  return vec4<f32>(mixedColor.rgb, mixedColor.a * uniforms.opacity);
}
`;
