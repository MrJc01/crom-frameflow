# 🔌 FrameFlow Plugin API

FrameFlow allows extending the engine with custom effects, audio processors, and analysis tools. Plugins are written in TypeScript/JavaScript and run within the main thread (for UI) or Worker thread (for processing).

## Architecture

Plugins implement the `Plugin` interface:

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  type: "effect" | "audio" | "tool";
  // ...
}
```

## Creating a Plugin

### 1. Effect Plugin (Shaders)

Effect plugins inject WebGL shaders into the composition pipeline.

```typescript
registerPlugin({
  id: "my-retro-filter",
  name: "Retro Filter",
  type: "effect",
  shader: `
    uniform float intensity;
    void main() {
      // ... GLSL code
    }
  `,
  parameters: [
    { name: "intensity", type: "float", default: 0.5, min: 0, max: 1 },
  ],
});
```

### 2. Audio Plugin (VST-like)

Audio plugins use `AudioWorklet` for real-time processing.

```typescript
registerPlugin({
  id: "gain-booster",
  type: "audio",
  process: (input, output, parameters) => {
    // DSP logic
  },
});
```

## Lifecycle

1. **Load**: App scans `plugins/` directory (or user folder).
2. **Init**: `initialize()` hook called.
3. **Render**: Applied during frame synthesis.
4. **Cleanup**: `destroy()` called on unload.

## Best Practices

- Keep processing lightweight (< 2ms per frame).
- Use `requestAnimationFrame` for UI updates.
- Properly dispose of WebGL resources.
