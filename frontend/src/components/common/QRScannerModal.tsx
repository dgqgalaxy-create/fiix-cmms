import React, { useEffect, useState, useRef } from 'react';
import { X, Camera, AlertCircle, Upload } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export const QRScannerModal: React.FC<Props> = ({ isOpen, onClose, onScan }) => {
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsScanning(true);
      
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScan(decodedText);
        },
        (errorMessage) => {
          // Ignore frequent parse errors (it happens when no QR is in frame)
        }
      ).catch((err) => {
        setError("Error al acceder a la cámara. Asegúrate de dar permisos.");
        console.error("QR Start Error:", err);
      });
    } else {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      setIsScanning(false);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleScan = (data: string | null) => {
    if (!data) return;

    if (
      data.startsWith('FIIX-ASSET:') ||
      data.startsWith('FIIX-ITEM:') ||
      data.startsWith('FIIX-LOCATION:')
    ) {
      onClose();
      onScan(data.trim());
      return;
    }

    setError('Código QR no reconocido por FIIX CMMS.');
    if (scannerRef.current) {
      scannerRef.current.pause(true);
      setTimeout(() => {
        if (scannerRef.current) scannerRef.current.resume();
        setError('');
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md relative flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Camera size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Escáner QR</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 aspect-square">
             <div id="qr-reader" className="w-full h-full"></div>
             {isScanning && !error && (
               <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                 <div className="w-[250px] h-[250px] border-4 border-white/50 rounded-2xl relative">
                   {/* Scanning animation line */}
                   <div className="w-full h-1 bg-emerald-500 absolute top-1/2 left-0 animate-[ping_2s_ease-in-out_infinite] shadow-[0_0_10px_2px_rgba(16,185,129,0.8)]"></div>
                 </div>
               </div>
             )}
          </div>
          
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-center text-slate-500 dark:text-slate-400 text-sm">
              Apunta la cámara al código QR de una máquina, repuesto o ubicación.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
