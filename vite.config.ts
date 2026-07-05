import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/StablefordCalc/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Stableford Rechner',
        short_name: 'Stableford',
        description: 'Stableford-Ergebnisse für bis zu 4 Golfspieler erfassen und live verfolgen',
        theme_color: '#0f1a12',
        background_color: '#0f1a12',
        display: 'standalone',
        start_url: '/StablefordCalc/',
        scope: '/StablefordCalc/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
