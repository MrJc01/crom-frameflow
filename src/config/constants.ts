export const APP_CONFIG = {
  PROJECT: {
    DEFAULT_WIDTH: 1920,
    DEFAULT_HEIGHT: 1080,
    DEFAULT_FPS: 30,
    DEFAULT_DURATION_MS: 5000,
  },
  THEME: {
    COLORS: {
      BACKGROUND: '#0d0d0d',
      BACKGROUND_RGB: '13, 13, 13',
    }
  },
  STORAGE: {
    KEY: 'frameflow-storage',
  },
  UI: {
      TOASTER_DURATION: 3000,
  }
} as const;
