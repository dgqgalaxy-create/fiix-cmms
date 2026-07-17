import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Home, Package, QrCode, Wrench } from 'lucide-react';
import { QRScannerModal } from './common/QRScannerModal';

const tabClass = (active: boolean) =>
  `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold tracking-wide transition-colors ${
    active ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
  }`;

/**
 * Barra inferior móvil exclusiva para rol TECNICO.
 * Admin/Gestionador no la ven: conservan la UX completa.
 */
export const TechnicianBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scannerOpen, setScannerOpen] = useState(false);

  const onMine = location.pathname.startsWith('/dashboard');
  const onInventory = location.pathname.startsWith('/inventory');
  const onHome = location.pathname.startsWith('/home');

  const handleScan = (code: string) => {
    if (code.startsWith('FIIX-ASSET:')) {
      navigate(`/assets?asset=${code.replace('FIIX-ASSET:', '').trim()}`);
      return;
    }
    if (code.startsWith('FIIX-ITEM:')) {
      navigate(`/inventory?item=${code.replace('FIIX-ITEM:', '').trim()}`);
      return;
    }
    if (code.startsWith('FIIX-LOCATION:')) {
      navigate(`/inventory?tab=locations&location=${code.replace('FIIX-LOCATION:', '').trim()}`);
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden"
        aria-label="Navegación rápida de técnico"
      >
        <div className="flex h-16 items-stretch">
          <NavLink to="/dashboard?tab=mine" className={tabClass(onMine)}>
            <Wrench size={20} />
            Mis OT
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
