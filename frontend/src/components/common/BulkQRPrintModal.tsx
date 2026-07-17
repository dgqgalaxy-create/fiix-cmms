import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export interface BulkQRItem {
  id: string;
  title: string;
  subtitle: string;
  value: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: BulkQRItem[];
  sheetTitle?: string;
}

export const BulkQRPrintModal: React.FC<Props> = ({ isOpen, onClose, items, sheetTitle = 'Etiquetas QR' }) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${sheetTitle}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: system-ui, sans-serif; margin: 16px; color: #0f172a; }
            h1 { font-size: 18px; margin: 0 0 16px 0; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
            .label {
              border: 1px dashed #94a3b8;
              border-radius: 12px;
              padding: 12px 8px;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .label h2 { margin: 0 0 4px 0; font-size: 12px; line-height: 1.3; }
            .label p { margin: 0 0 8px 0; font-size: 10px; color: #64748b; }
            .label svg { width: 96px; height: 96px; }
            @media print {
              body { margin: 8mm; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <h1>${sheetTitle} (${items.length})</h1>
          ${content.innerHTML}
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-3xl relative flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Impresión masiva de QR</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{items.length} etiqueta{items.length === 1 ? '' : 's'} seleccionada{items.length === 1 ? '' : 's'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {items.length === 0 ? (
            <p className="text-center text-slate-400 py-12">Selecciona al menos un elemento para imprimir.</p>
          ) : (
            <div ref={printRef}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((item) => (
                  <div key={item.id} className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-3 text-center bg-white dark:bg-slate-950">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-xs leading-snug line-clamp-2">{item.title}</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-mono">{item.subtitle}</p>
                    <div className="flex justify-center">
                      <QRCodeSVG value={item.value} size={96} level="H" includeMargin={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={items.length === 0}
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-sm"
          >
            <Printer size={16} /> Imprimir hoja
          </button>
        </div>
      </div>
    </div>
  );
};
