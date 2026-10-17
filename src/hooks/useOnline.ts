import { useSyncExternalStore } from 'react';

function suscribir(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** Estado de conectividad del navegador (navigator.onLine + eventos online/offline). */
export const useOnline = () => useSyncExternalStore(suscribir, () => navigator.onLine);
