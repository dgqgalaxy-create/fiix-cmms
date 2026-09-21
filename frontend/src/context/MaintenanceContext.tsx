import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../api/axios';
import { socket } from '../api/socket';

interface MaintenanceContextValue {
  isMaintenance: boolean;
  message: string;
}

const MaintenanceContext = createContext<MaintenanceContextValue>({
  isMaintenance: false,
  message: '',
});

/**
 * Escucha el evento socket `maintenance` (activo/desactivo) y lo expone a la app.
 * El backend activa el modo durante importaciones CSV/Sheets/Drive y lo desactiva al terminar.
 */
export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MaintenanceContextValue>({
    isMaintenance: false,
    message: '',
  });

  useEffect(() => {
    const onMaintenance = (payload?: { active?: boolean; message?: string }) => {
      setState({
        isMaintenance: Boolean(payload?.active),
        message: payload?.message || '',
      });
    };
    const refresh = () => { if (localStorage.getItem('token')) api.get('/maintenance-state').then(r => onMaintenance(r.data)).catch(() => {}); };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    socket.on('connect', refresh);
    socket.on('maintenance', onMaintenance);
    return () => {
      window.clearInterval(timer);
      socket.off('connect', refresh);
      socket.off('maintenance', onMaintenance);
    };
  }, []);

  return <MaintenanceContext.Provider value={state}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance(): MaintenanceContextValue {
  return useContext(MaintenanceContext);
}
