import React, { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  value: string;
}

export const QRDisplayModal: React.FC<Props> = ({ isOpen, onClose, title, subtitle, value }) => {
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
          <title>Imprimir QR - ${title}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { text-align: center; border: 2px dashed #cbd5e1; padding: 40px; border-radius: 16px; }
            h1 { margin: 0 0 10px 0; font-size: 24px; color: #0f172a; }
            p { margin: 0 0 30px 0; font-size: 16px; color: #64748b; }
            @page { size: letter portrait; margin: 12mm; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${title}</h1>
            <p>${subtitle}</p>
            ${content.innerHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-sm relative flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Código QR</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center">
          <div className="text-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>

          <div 
            ref={printRef}
            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <QRCodeSVG value={value} size={200} level="H" includeMargin={true} />
          </div>

          <p className="text-xs text-slate-400 font-mono mt-4 break-all text-center">
            {value}
          </p>

          <button
            onClick={handlePrint}
            className="mt-8 w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-400 text-white font-medium rounded-xl transition-colors"
          >
            <Printer size={18} />
            Imprimir Código
          </button>
        </div>
      </div>
    </div>
  );
};
