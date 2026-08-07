import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Level Up!',
    short_name: 'Level Up',
    description: 'Gamified habit tracker',
    // '/' resolves to /home or /auth/login depending on session, so it's the
    // right entry point for both a signed-in and signed-out launch.
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Matching --bg keeps the launch splash from flashing a different colour
    // before the app paints.
    background_color: '#0F0F0F',
    theme_color: '#0F0F0F',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
