import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Camera, AlertCircle, ImagePlus, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

const NOT_STARTED = 1;

const isFiixCode = (data: string) =>
  data.startsWith('FIIX-ASSET:') ||
  data.startsWith('FIIX-ITEM:') ||
  data.startsWith('FIIX-LOCATION:');

/** Detiene y limpia sin lanzar errores (stop() de html5-qrcode puede tirar strings). */
const safeStop = (scanner: Html5Qrcode | null): Promise<void> => {
  if (!scanner) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      let state = NOT_STARTED;
      try {
        state = scanner.getState();
      } catch {
        state = NOT_STARTED;
      }

      if (state !== NOT_STARTED) {
        try {
          const result = scanner.stop();
          if (result && typeof (result as Promise<void>).then === 'function') {
            (result as Promise<void>)
              .catch(() => undefined)
              .finally(() => {
                try {
                  scanner.clear();
                } catch {
                  // ignore
                }
                resolve();
              });
            return;
          }
        } catch {
          // "Cannot stop, scanner is not running or paused."
        }
      }

      try {
        scanner.clear();
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
    resolve();
  });
};

const cameraBlockedMessage = () => {
  const insecure = typeof window !== 'undefined' && !window.isSecureContext;
  if (insecure) {
    return (
      'La cámara en vivo no funciona por HTTP en el celular (solo HTTPS o localhost). ' +
      'Usa «Elegir foto» para escanear el QR desde la galería, o publica el sitio con HTTPS.'
    );
  }
  return 'No se pudo usar la cámara. Revisa los permisos del navegador o usa «Elegir foto».';
};

export const QRScannerModal: React.FC<Props> = ({ isOpen, onClose, onScan }) => {
  const reactId = useId().replace(/:/g, '');
  const readerId = `qr-reader-${reactId}`;
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileScannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const handledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const deliverScan = async (raw: string) => {
    const data = raw.trim();
    if (!isFiixCode(data)) {
      setError('Código QR no reconocido por FIIX CMMS.');
      return;
    }
    if (handledRef.current) return;
    handledRef.current = true;
    const live = scannerRef.current;
    scannerRef.current = null;
    await safeStop(live);
    onCloseRef.current();
    onScanRef.current(data);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setIsReadingFile(true);
    setError('');
    try {
      // scanFile exige estado NOT_STARTED y un elemento DOM propio
      const hostId = `qr-file-${reactId}`;
      let host = document.getElementById(hostId);
      if (!host) {
        host = document.createElement('div');
        host.id = hostId;
        host.style.display = 'none';
        document.body.appendChild(host);
      }
      await safeStop(fileScannerRef.current);
      fileScannerRef.current = new Html5Qrcode(hostId);
      const decoded = await fileScannerRef.current.scanFile(file, false);
      await safeStop(fileScannerRef.current);
      fileScannerRef.current = null;
      await deliverScan(decoded);
    } catch (err) {
      console.error('QR file scan error:', err);
      setError('No se leyó un QR válido en la foto. Enfoca bien el código e intenta de nuevo.');
      await safeStop(fileScannerRef.current);
      fileScannerRef.current = null;
    } finally {
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!isOpen) {
      handledRef.current = false;
      setIsScanning(false);
      setIsReadingFile(false);
      setError('');
      const live = scannerRef.current;
      scannerRef.current = null;
      void safeStop(live);
      return;
    }

    handledRef.current = false;
    setError('');
    let cancelled = false;
    let startTimer: ReturnType<typeof setTimeout> | undefined;

    // Sin contexto seguro (http://IP): no intentes getUserMedia; evita crash al cerrar.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setIsScanning(false);
      setError(cameraBlockedMessage());
      return;
    }

    startTimer = setTimeout(() => {
      if (cancelled) return;

      const el = document.getElementById(readerId);
      if (!el) {
        setError('No se pudo iniciar la cámara. Cierra e intenta de nuevo.');
        return;
      }

      void (async () => {
        try {
          await safeStop(scannerRef.current);
          scannerRef.current = null;

          const scanner = new Html5Qrcode(readerId);
          if (cancelled) {
            await safeStop(scanner);
            return;
          }
          scannerRef.current = scanner;
          setIsScanning(true);

          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              if (cancelled || handledRef.current) return;
              void deliverScan(decodedText);
            },
            () => undefined,
          );
        } catch (err) {
          if (cancelled) return;
          console.error('QR Start Error:', err);
          setIsScanning(false);
          setError(cameraBlockedMessage());
          const failed = scannerRef.current;
          scannerRef.current = null;
          await safeStop(failed);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      if (startTimer) clearTimeout(startTimer);
      const live = scannerRef.current;
      scannerRef.current = null;
      void safeStop(live);
    };
  }, [isOpen, readerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0">
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
            type="button"
            onClick={() => {
              const live = scannerRef.current;
              scannerRef.current = null;
              void safeStop(live).finally(() => onClose());
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-4 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 rounded-xl text-sm font-medium flex items-start gap-2 border border-amber-200 dark:border-amber-800">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 aspect-square">
            <div id={readerId} className="w-full h-full" />
            {isScanning && !error && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[250px] h-[250px] border-4 border-white/50 rounded-2xl relative">
                  <div className="w-full h-1 bg-emerald-500 absolute top-1/2 left-0 animate-[ping_2s_ease-in-out_infinite] shadow-[0_0_10px_2px_rgba(16,185,129,0.8)]" />
                </div>
              </div>
            )}
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300 text-sm">
                <Camera size={36} className="opacity-50" />
                <span>Cámara en vivo no disponible en este momento</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]">
              {isReadingFile ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              {isReadingFile ? 'Leyendo QR…' : 'Elegir foto / galería'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={isReadingFile}
                onChange={(e) => void handleFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-center text-slate-500 dark:text-slate-400 text-sm">
              En celular por IP (HTTP) usa la foto. Con HTTPS la cámara en vivo también funciona.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
