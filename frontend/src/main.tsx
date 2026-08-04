import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'
import { vibrateChatAlert } from './utils/chatNotify'

// autoUpdate + skipWaiting/clientsClaim: al desplegar, el SW nuevo toma control.
// onNeedRefresh: avisa a UpdateBanner; si el soft-update falla, el banner hace hard reload
// (unregister SW + limpiar Cache Storage).
let updateSW: (reloadPage?: boolean) => Promise<void | boolean | undefined> = async () => undefined
updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent('fiix-sw-need-refresh', {
        detail: {
          updateSW: (reloadPage?: boolean) => updateSW(reloadPage ?? true),
        },
      })
    )
    // Aplicar en cuanto haya SW nuevo (no esperar al clic)
    void updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    // Buscar updates con más frecuencia (deploy en LAN / Tailscale)
    if (registration) {
      window.setInterval(() => {
        void registration.update()
      }, 60 * 1000)
    }
  },
})

// Push en segundo plano: el SW pide vibrar (Android suele ignorar vibrate de la notificación)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data as { type?: string; pattern?: number[] } | undefined
    if (data?.type === 'fiix-vibrate') {
      vibrateChatAlert(Array.isArray(data.pattern) ? data.pattern : undefined)
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
