/** Vibración corta tipo chat (Android / algunos navegadores). */
export const CHAT_VIBRATE_PATTERN = [400, 120, 400, 120, 400];

export function vibrateChatAlert(pattern: number[] = CHAT_VIBRATE_PATTERN) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Tono corto de mensaje (Web Audio). Requiere gesto previo del usuario
 * (login / toque) por la política de autoplay del navegador.
 */
export function playChatNotifySound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);

    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(master);
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };

    // Dos notas ascendentes (tipo aviso de chat)
    beep(880, 0, 0.12);
    beep(1175, 0.14, 0.16);

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 500);
  } catch {
    /* Autopolicy / Audio no disponible */
  }
}

type IncomingChatNotifyOpts = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/**
 * Aviso de sistema cuando la PWA está en segundo plano (pestaña oculta)
 * pero el socket aún entregó el mensaje. Complementa Web Push.
 */
export async function showIncomingChatSystemNotification(opts: IncomingChatNotifyOpts) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  // En primer plano el banner in-app basta; evitar doble aviso
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }

  const options: NotificationOptions & { vibrate?: number[]; silent?: boolean } = {
    body: opts.body,
    icon: '/icono_app.jpg',
    badge: '/icono_app.jpg',
    tag: opts.tag,
    renotify: true,
    silent: false,
    data: { url: opts.url },
    vibrate: CHAT_VIBRATE_PATTERN,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(opts.title, options);
      return;
    }
  } catch {
    /* fallback abajo */
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(opts.title, options);
  } catch {
    /* ignore */
  }
}
