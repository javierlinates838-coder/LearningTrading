import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';
import { appStore } from './storage/store';
import { initPwa } from './pwa';

void appStore.init();
initPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
