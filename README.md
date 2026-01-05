# 🎬 Crom-FrameFlow

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Tauri](https://img.shields.io/badge/tauri-v2-orange)

**Crom-FrameFlow** is a next-generation video editing engine built with web technologies, designed for performance, collaboration, and extensibility. It leverages **WebGPU** for real-time effects and **Rust/Tauri** for native performance.

## 🚀 Key Features

- **High-Performance Timeline**: Virtualized rendering handling 500+ clips.
- **WebGPU Rendering**: Real-time effects, transitions, and color grading.
- **Collaborative Editing**: P2P remote viewing via WebRTC.
- **AI-Powered**: Local AI models for segmentation and auto-captioning (roadmap).
- **Extensible**: Plugin system for custom effects and tools.
- **Cross-Platform**: Windows, macOS, and Linux support.

## 🛠️ Tech Stack

- **Core**: React 19, TypeScript, Vite
- **State**: Zustand (with temporal undo/redo)
- **Backend**: Tauri (Rust)
- **Graphics**: WebGPU / WebGL (via PIXI/Three fallback)
- **Tests**: Vitest, Playwright

## 📦 Getting Started

See [docs/setup.md](./docs/setup.md) for detailed instructions.

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run development server
npm run dev

# Run unit tests
npm run test

# Build for production
npm run build
```

## 📚 Documentation

- [Plugin API](./docs/plugins.md)
- [Contributing](./CONTRIBUTING.md)
- [Setup Guide](./docs/setup.md)

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT © 2024-2026 Crom-FrameFlow Contributors
