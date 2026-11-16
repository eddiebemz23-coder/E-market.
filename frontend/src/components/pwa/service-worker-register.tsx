'use client';

import { useEffect } from 'react';

/**
 * Registers the offline rail. Skipped outside production because a caching worker in `next
 * dev` would serve stale bundles while you edit. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return null;
}
