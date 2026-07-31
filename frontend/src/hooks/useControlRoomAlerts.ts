import { useEffect, useRef, useState } from 'react';

const SOUND_KEY = 'fiix-control-room-sound';
const BASE_TITLE = 'GTZ CMMS';

export type ControlRoomCounts = {
  urgentOpen: number;
  unassigned: number;
  slaRisk: number;
  slaBreached: number;
};

function criticalTotal(c: ControlRoomCounts) {
  return c.urgentOpen + c.unassigned + c.slaRisk + c.slaBreached;
}

function playAlertBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.27;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // Autopolicy / Audio no disponible
  }
}

/**
 * Badge en document.title y beep opcional cuando suben OT críticas en Inicio.
 */
export function useControlRoomAlerts(
  counts: ControlRoomCounts,
  enabled: boolean
) {
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_KEY);
    return stored === null ? true : stored === '1' || stored === 'true';
  });
  const prevCritical = useRef<number | null>(null);

  const setSoundEnabled = (on: boolean) => {
    setSoundEnabledState(on);
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  };

  useEffect(() => {
    if (!enabled) {
      document.title = BASE_TITLE;
      return;
    }
    const total = criticalTotal(counts);
    document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;

    if (prevCritical.current !== null && total > prevCritical.current && soundEnabled) {
      playAlertBeep();
    }
    prevCritical.current = total;

    return () => {
      document.title = BASE_TITLE;
    };
  }, [counts.urgentOpen, counts.unassigned, counts.slaRisk, counts.slaBreached, enabled, soundEnabled]);

  return { soundEnabled, setSoundEnabled };
}
