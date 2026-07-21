import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Home, Package, QrCode, ListChecks } from 'lucide-react';
import { QRScannerModal } from './common/QRScannerModal';
import { parseFiixQr } from '../utils/fiixQr';

const tabClass = (active: boolean) =>
  `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold tracking-wide transition-colors ${
    active ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
  }`;

/**
 * Barra inferior móvil exclusiva para rol TECNICO.
 * Admin/Gestionador no la ven: conservan la UX completa.
 * «Mi día» = OT asignadas pendientes + en espera (pausadas). Las en proceso van en Mis Órdenes.
 */
export const TechnicianBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scannerOpen, setScannerOpen] = useState(false);

  const onMine = location.pathname.startsWith('/dashboard');
  const onInventory = location.pathname.startsWith('/inventory');
  const onHome = location.pathname.startsWith('/home');

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
          <NavLink to="/dashboard?tab=mine&myday=1" className={tabClass(onMine)}>
            <ListChecks size={20} />
            Mi día
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
