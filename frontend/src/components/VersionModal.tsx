import { X, Info, Rocket, Server, Shield, CheckCircle2, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const APP_VERSION = "1.9.1";

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionModal = ({ isOpen, onClose }: VersionModalProps) => {
  if (!isOpen) return null;

  const version = APP_VERSION;
  const updateDate = "10 de Julio, 2026";
  const modules = [
    "Panel Principal (Dashboard)",
    "Gestión de Activos (Equipos)",
    "Catálogo de Inventario",
    "Planes Preventivos",
    "Módulo de Compras",
    "Zonas y Permisos",
    "Directorio y Solicitantes",
    "KPIs y Metas",
    "Checklist Diario",
    "Calendario de Horarios y Turnos (Roster)",
    "Opciones de Desarrollador"
  ];
  const changelog = [
    "Habilitado el registro de movimientos para técnicos directamente desde la vista de Repuestos.",
    "Actualizaciones silenciosas: el guardado en Inventario ya no interrumpe tu pantalla con una carga.",
    "Stock y movimientos más flexibles: permite registrar fracciones o decimales (ej. litros, metros) al escribir, y subir/bajar enteros con la perilla.",
    "Mejora en Dashboard: Se añadió la indicación dinámica del periodo en la tarjeta de Totales Recibidas.",
    "Validación de inventario: El stock mínimo ahora debe ser estrictamente mayor a 0."
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 flex flex-col items-center justify-center relative shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
          
          <img src="/lpet.png" alt="LPET Logo" className="h-16 object-contain mb-3" />
          <h2 className="text-2xl font-black text-white tracking-widest uppercase">CMMS MTTO</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold border border-emerald-500/30">
            <Rocket size={14} />
            Versión {version}
          </span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-bold text-slate-800">Última Actualización</p>
              <p className="text-sm text-slate-600 mt-1">{updateDate}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className="text-amber-500 text-lg">✨</span> Novedades (v{version})
            </h3>
            <ul className="space-y-2">
              {changelog.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  {change}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Server size={16} className="text-slate-400" />
              Módulos Instalados
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {modules.map((mod, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  {mod}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col items-center gap-3">
          <Link 
            to="/manual" 
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition-colors border border-blue-200"
          >
            <BookOpen size={18} />
            Abrir Manual de Usuario
          </Link>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 mt-1">
            <Shield size={14} />
            Conexión segura y encriptada
          </p>
        </div>

      </div>
    </div>
  );
};
