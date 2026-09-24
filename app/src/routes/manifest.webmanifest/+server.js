import { json } from '@sveltejs/kit';

// Server route instead of a static file so dev/prod can show a different
// name on the home-screen icon (APP_NAME env var) — same PWA otherwise,
// both point at the same Postgres, and mixing them up on a phone is easy.
const name = process.env.APP_NAME || 'MyFinance';

export function GET() {
  return json(
    {
      name,
      short_name: name,
      description: 'Personal finance tracker',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#0a0b0d',
      theme_color: '#0a0b0d',
      orientation: 'portrait',
      icons: [
        { src: '/icons/icon-64.png', sizes: '64x64', type: 'image/png' },
        { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png' },
        { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    { headers: { 'content-type': 'application/manifest+json' } }
  );
}
