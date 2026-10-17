import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El Service Worker se registra solo en el build de producción: en `npm run dev`
// Vite sirve módulos sin empaquetar y cachearlos rompería el recargado en caliente.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.info('[SW] registrado con alcance', reg.scope))
      .catch((err) => console.error('[SW] error al registrar', err));
  });
}
