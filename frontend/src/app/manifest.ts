import type { MetadataRoute } from 'next';

/**
 * PWA manifest: installing the site from the browser is the distribution channel for a
 * marketplace whose buyers are on congested phones with little storage — no store account,
 * and every deploy updates the app automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bemz Africa Marketplace',
    short_name: 'Bemz',
    description: 'Discover shops, buy and sell, and connect with traders across Africa.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3faf5',
    theme_color: '#1f8a4c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
