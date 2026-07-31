/** Sonido corto tipo «bip» al leer un QR (Web Audio API). */
export function playScanBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1200;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    osc.start(t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.stop(t0 + 0.1);
    osc.onended = () => {
      void ctx.close().catch(() => undefined);
    };
  } catch {
    // Autopolicy / Audio no disponible
  }
}
