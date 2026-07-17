import { X, Info, Rocket, Server, Shield, CheckCircle2, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const APP_VERSION = "1.11.10";

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionModal = ({ isOpen, onClose }: VersionModalProps) => {
  if (!isOpen) return null;

  const version = APP_VERSION;
  const updateDate = "16 de Julio, 2026";
  const modules = [
    "Inicio (Resumen Operativo)",
    "Órdenes de Trabajo",
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
    "Corrección: La importación de CSV interpreta bien los tiempos de reparación con coma de miles (ej. \"2,140.22\" min), evitando MTTR distorsionado.",
    "Mejora: Al importar los 7 CSV a la vez, el sistema los procesa siempre en el orden correcto y crea automáticamente los usuarios de inventario faltantes para no perder movimientos.",
    "Corrección: Recálculo de KPIs (MTTR solo correctivas, backlog real, disponibilidad por paros, periodos por completed_at/started_at, metas en horas).",
    "Mejora: KPIs rediseñados como scoreboard industrial: salud de planta, semáforo de metas, gráficos accionables y carga por técnico.",
    "Corrección: KPIs y Metas ya no oculta el selector de periodo cuando no hay órdenes en el mes actual; puedes cambiar a Año o Histórico para ver métricas.",
    "Mejora: El filtro de periodo en Inicio ahora encierra en un marco visual todas las tarjetas y gráficas a las que se aplica.",
    "Mejora: La distribución de mantenimientos en Inicio estrena un diseño ejecutivo con gráfica de dona, total central, porcentajes y barras comparativas.",
    "Mejora: Al hacer clic en una notificación de la campana se abre directamente el detalle de esa orden de trabajo.",
    "Nuevo: En Inicio, resumen visual de órdenes finalizadas de la semana actual (Lunes a Domingo), con gráfica diaria y listado.",
    "Nuevo: Módulo Inicio con el resumen operativo (Pareto, tarjetas de estado y gráfica de mantenimiento). Las Órdenes de Trabajo quedan solo con Vista General, Mis Órdenes, Historial, búsqueda y filtros.",
    "Mejora: El Portal de Solicitudes ahora usa el mismo formulario que Nueva Orden (desplegable de solicitantes, zona, activo, etc.), sin asignación de técnicos ni foto.",
    "Corrección: Las órdenes creadas desde Nueva Orden también envían notificación a Telegram cuando está activada.",
    "Corrección: Calendario y Horarios se visualizan correctamente en celular y tablet (altura adaptativa y toolbar responsive).",
    "Mejora: Todos los roles pueden consultar el Árbol de Fallas; solo Administrador y Gestionador pueden editarlo.",
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
