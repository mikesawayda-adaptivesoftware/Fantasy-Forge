'use client';

import { useEffect } from 'react';

/** Registers the service worker in production builds (installable app + offline fallback) */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(error => {
      console.warn('Service worker registration failed', error);
    });
  }, []);
  return null;
}
