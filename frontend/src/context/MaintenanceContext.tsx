import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
    socket.on('maintenance', onMaintenance);
    return () => {
      socket.off('maintenance', onMaintenance);
    };
  }, []);

  return <MaintenanceContext.Provider value={state}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance(): MaintenanceContextValue {
  return useContext(MaintenanceContext);
}
