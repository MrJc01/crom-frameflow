import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { PresentationWindow } from './components/PresentationWindow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorMonitor } from './services/ErrorMonitor';

import { AudioProvider } from './contexts/AudioContext';

// Initialize Error Monitor
ErrorMonitor.init();

// Simple Routing
const pathname = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark">
      <ErrorBoundary>
        <AudioProvider>
          {pathname === '/present' ? <PresentationWindow /> : <App />}
        </AudioProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
)
