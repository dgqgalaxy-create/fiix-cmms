import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'

// autoUpdate: al desplegar, la PWA toma el build nuevo (evita quedarse en versión vieja).
// onNeedRefresh: avisa / refuerza recarga si hace falta.
let updateSW: (reloadPage?: boolean) => Promise<void | boolean | undefined> = async () => undefined
updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent('fiix-sw-need-refresh', {
        detail: {
          updateSW: () => {
            void updateSW(true)
          },
        },
      })
    )
    // Aplicar en cuanto haya SW nuevo (no esperar al clic)
    void updateSW(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
