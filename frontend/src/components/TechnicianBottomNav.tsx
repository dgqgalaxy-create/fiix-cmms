import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Home, Package, QrCode, ListChecks, MessageSquare } from 'lucide-react';
import { QRScannerModal } from './common/QRScannerModal';
import { parseFiixQr } from '../utils/fiixQr';
import { getChatUnreadSummary } from '../api/chat';
import { getMineOpenCount } from '../api/workOrders';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { useAuth } from '../context/AuthContext';

const tabClass = (active: boolean) =>
  `relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold tracking-wide transition-colors ${
    active ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
  }`;

const BadgeIcon = ({ count, children }: { count: number; children: ReactNode }) => (
  <span className="relative inline-flex">
    {children}
    {count > 0 && (
      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-black leading-none text-white">
        {count > 99 ? '99+' : count}
      </span>
    )}
  </span>
);

/**
 * Barra inferior móvil de la interfaz compacta
 * (Técnico / Gestionador / Administrador con la preferencia activa).
 * Orden: Mis OT · Mensajes · Escanear · Inventario · Inicio
 */
export const TechnicianBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [chatBadge, setChatBadge] = useState(0);
  const [mineBadge, setMineBadge] = useState(0);

  const onMine = location.pathname.startsWith('/dashboard');
  const onMessages = location.pathname.startsWith('/messages');
  const onInventory = location.pathname.startsWith('/inventory');
  const onHome = location.pathname.startsWith('/home');

  const refreshChatBadge = useCallback(async () => {
    try {
      const s = await getChatUnreadSummary();
      setChatBadge(s.unread_total || 0);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshMineBadge = useCallback(async () => {
    if (!user?.id) {
      setMineBadge(0);
      return;
    }
    try {
      setMineBadge(await getMineOpenCount());
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  useEffect(() => {
    refreshChatBadge();
    refreshMineBadge();
  }, [refreshChatBadge, refreshMineBadge, user?.id]);

  useSocketRefresh(['refresh_chat', 'chat_message'], refreshChatBadge);
  useSocketRefresh(['refresh_work_orders', 'work_order_updated'], refreshMineBadge);

  const handleScan = (code: string) => {
    const parsed = parseFiixQr(code);
    if (!parsed.id) {
      alert('No se leyó ningún código QR.');
      return;
    }

    const q = encodeURIComponent(parsed.id);

    if (parsed.kind === 'asset') {
      navigate(`/assets?asset=${q}`);
      return;
    }
    if (parsed.kind === 'item') {
      navigate(`/inventory?tab=items&item=${q}`);
      return;
    }
    if (parsed.kind === 'location') {
      navigate(`/inventory?tab=locations&location=${q}`);
      return;
    }

    // Sin prefijo: probar ubicación/repuesto por código interno (ej. E2-0).
    navigate(`/inventory?scan=${q}`);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden"
        aria-label="Navegación rápida de técnico"
      >
        <div className="flex h-16 items-stretch">
          <NavLink to="/dashboard?tab=mine" className={tabClass(onMine)}>
            <BadgeIcon count={mineBadge}>
              <ListChecks size={20} />
            </BadgeIcon>
            Mis OT
          </NavLink>

          <NavLink to="/messages" className={tabClass(onMessages)}>
            <BadgeIcon count={chatBadge}>
              <MessageSquare size={20} />
            </BadgeIcon>
            Mensajes
          </NavLink>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold tracking-wide text-slate-400 transition-colors hover:text-white"
          >
            <span className="flex h-9 w-9 -mt-3 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-700/30 ring-4 ring-slate-950">
              <QrCode size={20} />
            </span>
            Escanear
          </button>

          <NavLink to="/inventory" className={tabClass(onInventory)}>
            <Package size={20} />
            Inventario
          </NavLink>

          <NavLink to="/home" className={tabClass(onHome)}>
            <Home size={20} />
            Inicio
          </NavLink>
        </div>
      </nav>

      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </>
  );
};
