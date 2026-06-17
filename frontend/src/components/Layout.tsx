import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, Camera } from 'lucide-react';
import { QRScannerModal } from './common/QRScannerModal';

export const Layout = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Backdrop overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-30 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Mobile Header */}
      <header className="print:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 text-white flex items-center justify-between px-4 z-30 md:hidden border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-lg tracking-tight">LPET CMMS</span>
        </div>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen pt-20 md:pt-8 relative print:ml-0 print:p-0 print:h-auto print:overflow-visible print:pt-0">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>

        {/* Floating Action Button for Scanner */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="print:hidden fixed bottom-6 right-6 md:bottom-10 md:right-10 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-30 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
          title="Escáner Inteligente QR"
        >
          <Camera size={24} />
        </button>
      </div>

      <QRScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
      />
    </div>
  );
};
