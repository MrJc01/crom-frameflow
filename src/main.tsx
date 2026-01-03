import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { PresentationWindow } from './components/PresentationWindow';

// Simple Routing
const pathname = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {pathname === '/present' ? <PresentationWindow /> : <App />}
  </React.StrictMode>,
)
