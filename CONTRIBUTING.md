# Contributing to FrameFlow

Thank you for your interest in contributing to FrameFlow!

## Development Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/MrJc01/crom-frameflow.git
   ```

2. **Install dependencies**:

   ```bash
   npm install --legacy-peer-deps
   ```

   _Note: We use `--legacy-peer-deps` due to React 19 rc dependency conflicts._

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

## Architecture

- **Engine**: `src/engine/` - Core editing logic, WebGPU/WebGL renderers.
- **Store**: `src/stores/` - Zustand state management.
- **UI**: `src/components/` - React components (TailwindCSS).
- **Utils**: `src/utils/` - Helper functions (ffmpeg, audio, etc).

## Pull Request Guidelines

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Ensure tests pass: `npm run test`
3. If changing UI, verify with `npm run test:visual`.
4. Submit PR with detailed description.

## Code Style

- Use **TypeScript** for all new code.
- Follow functional patterns where possible.
- Use explicit types, avoid `any`.
