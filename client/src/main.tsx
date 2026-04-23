import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import { App } from './App.js';
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
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            className:
              'border-2 border-ink bg-bone text-ink font-mono uppercase text-sm shadow-[var(--shadow-brutal-sm)]',
          }}
        />
      </PreferencesProvider>
    </AuthProvider>
  </StrictMode>,
);
