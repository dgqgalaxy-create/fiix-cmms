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
    // Sin proxy a la API: en DEV axios usa hostname:3000 directo (ver resolveBackendUrl).
    // Así las subidas grandes (zip import) no pasan por el proxy de Vite.
  },
  build: {
    chunkSizeWarningLimit: 3000, // KB — evita confundir el warning de Vite con el fallo de Workbox
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('xlsx') || id.includes('sheetjs')) return 'vendor-xlsx';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('react-router')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icono_app.jpg'],
      manifest: {
        name: 'GTZ CMMS',
        short_name: 'GTZ',
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
        // Activar SW nuevo de inmediato (evita tabs eternas con APP_VERSION vieja)
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Handlers push / notificationclick
        importScripts: ['/push-sw.js'],
        // Cache API requests
        runtimeCaching: [
          {
            // Solo GET: no interceptar POST/PUT de import CSV+zip (body grande → Network Error).
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              /\/(api|socket\.io)\//i.test(url.pathname),
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
