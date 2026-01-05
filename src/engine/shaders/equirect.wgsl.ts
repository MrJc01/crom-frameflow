export const equirectShader = `
// Vertex shader: pass-through quad
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) uv : vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, -1.0)
  );

  var output : VertexOutput;
  output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  output.uv = pos[VertexIndex] * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
  return output;
}

// Fragment shader: Equirectangular re-projection
struct ViewParams {
  yaw: f32,   // radians
  pitch: f32, // radians
  fov: f32,   // radians (vertical FOV)
  aspect: f32,
}

@group(0) @binding(0) var mySampler : sampler;
@group(0) @binding(1) var myTexture : texture_external;
@group(0) @binding(2) var<uniform> params : ViewParams;

fn rotate(v: vec3<f32>, axis: vec3<f32>, angle: f32) -> vec3<f32> {
    let s = sin(angle);
    let c = cos(angle);
    let oc = 1.0 - c;
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * oc;
}

const PI = 3.14159265359;
const TWO_PI = 6.28318530718;

@fragment
fn fs_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    // 1. Convert UV to Normalized Device Coordinates (NDC) [-1, 1]
    let ndc = uv * 2.0 - 1.0; 

    // 2. Generate Ray Direction from Camera
    let tan_half_fov = tan(params.fov * 0.5);
    let screen_dist = 1.0 / tan_half_fov;
    
    let ray_dir_cam = normalize(vec3<f32>(ndc.x * params.aspect, -ndc.y, -screen_dist));

    // 3. Apply Camera Rotation (Yaw, Pitch)
    var dir = rotate(ray_dir_cam, vec3<f32>(1.0, 0.0, 0.0), params.pitch);
    dir = rotate(dir, vec3<f32>(0.0, 1.0, 0.0), params.yaw);

    // 4. Convert Ray Direction (Sphere) to Equirectangular UV
    let phi = asin(dir.y);
    let theta = atan2(dir.z, dir.x);
    
    let u = (theta + PI) / TWO_PI;
    let v = (phi + PI / 2.0) / PI;
    
    // Sample texture with filtering
    let color = textureSampleBaseClampToEdge(myTexture, mySampler, vec2<f32>(u, 1.0 - v));
    
    return color;
}
`;
