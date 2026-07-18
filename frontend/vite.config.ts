import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Hostnames del Header "Host" permitidos en Vite (dev / preview).
    // "lpet-cmms" = nombre local en red; ".ts.net" = cualquier máquina MagicDNS de Tailscale.
    allowedHosts: ['lpet-cmms', '.ts.net'],
  },
  build: {
    chunkSizeWarningLimit: 3000, // KB — evita confundir el warning de Vite con el fallo de Workbox
  },
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icono_app.jpg'],
      manifest: {
        name: 'Fiix CMMS',
        short_name: 'Fiix',
        description: 'Gestor de Mantenimiento',
        theme_color: '#ffffff',
        start_url: '/home',
        icons: [
          {
            src: 'icono_app.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'icono_app.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      },
      workbox: {
        // Bundle JS ~2.5 MB; default Workbox limit is 2 MiB and fails the build
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // Cache API requests
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/(api|socket\.io)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
})
