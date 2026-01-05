# Quick Setup Guide

## Requirements

- **Node.js**: v18+
- **Rust**: (Optional, for Tauri backend)
- **Browser**: Chrome/Edge 113+ (WebGPU support recommended)

## 🚀 Getting Started

1. **Install Dependencies**

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Run Locally**

   ```bash
   npm run dev
   ```

   Access at `http://localhost:5173`.

3. **Build for Production**
   ```bash
   npm run build
   ```

## Troubleshooting

- **WebGPU Errors**: Ensure your browser supports WebGPU or check `chrome://gpu`.
- **Dependency Conflicts**: Always use `--legacy-peer-deps` if `npm install` fails.
- **Audio Context**: Click anywhere on the page to resume AudioContext if suspended.
