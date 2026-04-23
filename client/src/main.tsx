import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { BrutalToaster } from './components/feedback/BrutalToaster.js';
import { AuthProvider } from './context/AuthContext.js';
import { PreferencesProvider } from './context/PreferencesContext.js';

import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <PreferencesProvider>
        <App />
        <BrutalToaster />
      </PreferencesProvider>
    </AuthProvider>
  </StrictMode>,
);
