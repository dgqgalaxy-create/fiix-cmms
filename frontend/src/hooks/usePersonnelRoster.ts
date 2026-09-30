import { useCallback, useEffect, useRef, useState } from 'react';
import { getRoster, type RosterResponse } from '../api/roster';
import { addDays, plantDay } from '../utils/weeklyReport';
import { useSocketRefresh } from './useSocketRefresh';

export function usePersonnelRoster() {
  const [snapshot, setSnapshot] = useState<{ day: string; roster: RosterResponse } | null>(null);
  const [now, setNow] = useState(Date.now);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    const instant = Date.now();
    const day = plantDay(new Date(instant));
    try {
      const roster = await getRoster(addDays(day, -1), day);
      if (id !== requestId.current) return;
      setNow(Date.now());
      setSnapshot({ day, roster });
      setFailed(false);
    } catch {
      if (id === requestId.current) { setNow(Date.now()); setFailed(true); }
    }
  }, []);
  useEffect(() => {
    // Load the external roster when this subscription mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      // Invalidate the latest request, not just the one started on mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);
  useSocketRefresh(['refresh_roster', 'connect'], refresh);
  const today = plantDay(new Date(now));
  return { roster: !failed && snapshot?.day === today ? snapshot.roster : null, today, now, failed, refresh };
}
