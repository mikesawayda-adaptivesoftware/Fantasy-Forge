import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FantasyForge',
    short_name: 'FantasyForge',
    description: 'League-aware fantasy football tools for Sleeper managers.',
    start_url: '/my-teams',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'My Teams', url: '/my-teams' },
      { name: 'Waivers', url: '/waivers' },
      { name: 'Players', url: '/players' },
    ],
  };
}
