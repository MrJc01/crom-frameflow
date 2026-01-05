# Crom-FrameFlow Architecture

## Overview

FrameFlow is a hybrid video editor that combines the flexibility of web technologies (React) with the performance of native code (Rust/Tauri) and GPU acceleration (WebGPU).

## Core Components

### 1. The React Frontend (`src/`)

- **State Management**: Zustand stores (`useAppStore`, `timelineSlice`) hold the source of truth for the project model (clips, tracks, effects).
- **UI Architecture**: Component-based UI using TailwindCSS.
- **Viewport**: The canvas where the composition is rendered.

### 2. The Composition Engine (`src/engine/`)

The engine is responsible for rendering the timeline to the canvas.

- **`CompositionEngine`**: The main controller. It synchronizes the playback clock with the render loop.
- **`Renderer`**: Handles the WebGPU/WebGL pipeline. It takes a list of `RenderNode`s (clips, effects) and composites them.
- **`ResourceManager`**: Manages video textures, buffers, and cache cleanup.

### 3. Native Backend (`src-tauri/`)

Built with Rust, it handles system-level operations:

- File I/O (reading/writing large video files).
- ffmpeg integration (rendering exports).
- Window management.

## Data Flow: React <-> Rust

### React to Rust (Commands)

React invokes Tauri commands for heavy lifting:

```typescript
// Example: Exporting a video
await invoke("export_video", { config: exportConfig });
```

### Rust to React (Events)

Rust sends events for long-running processes:

```typescript
// Listening for export progress
listen("export-progress", (event) => {
  updateProgressBar(event.payload);
});
```

## The Render Loop

1. **Update**: `requestAnimationFrame` triggers `CompositionEngine.tick()`.
2. **Reconciliation**: The engine checks the current time against the `Track` data.
3. **Resource Prep**: Needed frames are extracted from video elements or decoded via WebCodecs.
4. **Draw**:
   - Background clear.
   - Draw clips (bottom-up z-order).
   - Apply Effects (shaders).
   - Draw overlays/gizmos.
5. **Present**: The canvas is updated.

## Plugin System

Plugins inject logic into step 4 (Draw). They can define custom shaders or processing steps. See `docs/plugins.md` for details.
