import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, Menu, Wrench, Users, Shield, Package, LayoutDashboard, ArrowLeft } from 'lucide-react';

const SECTIONS = [
  { id: 'intro', title: 'Introducción', icon: <BookOpen size={18} /> },
  { id: 'dashboard', title: 'Dashboard y Órdenes', icon: <LayoutDashboard size={18} /> },
  { id: 'inventory', title: 'Inventario y Compras', icon: <Package size={18} /> },
  { id: 'assets', title: 'Activos', icon: <Wrench size={18} /> },
  { id: 'roles', title: 'Roles y Permisos', icon: <Shield size={18} /> },
  { id: 'users', title: 'Gestión de Personal', icon: <Users size={18} /> },
];

export const UserManual = () => {
  const [activeSection, setActiveSection] = useState('intro');
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="text-blue-600 dark:text-blue-400" size={28} />
            Manual de Usuario
          </h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Guía completa de uso de LPET CMMS.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row h-[calc(100vh-180px)]">
        
        {/* Sidebar de navegación */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeSection === sec.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                }`}
              >
                {sec.icon}
                {sec.title}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 text-slate-700 dark:text-slate-300">
          <div className="max-w-3xl mx-auto space-y-8">
            
            {activeSection === 'intro' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                  <BookOpen size={32} />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">Bienvenido a LPET CMMS</h2>
                <p className="text-lg leading-relaxed mb-4">
                  El Sistema de Gestión de Mantenimiento Asistido por Computadora (CMMS) de LPET está diseñado para optimizar, organizar y dar seguimiento a todas las operaciones de mantenimiento dentro de tu planta.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl mt-6">
                  <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">💡 Tip de Navegación</h3>
                  <p className="text-blue-700 dark:text-blue-400/80">
                    Utiliza la barra lateral izquierda para explorar los diferentes módulos del sistema. Si tienes el modo oscuro activado (en Configuración), la interfaz se adaptará automáticamente.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">Dashboard y Órdenes</h2>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-8 mb-3">1. Creación de Órdenes</h3>
                <p>Las órdenes de trabajo son el corazón del sistema. Puedes crear órdenes Preventivas, Correctivas o Predictivas. Al crear una orden, asegúrate de:</p>
                <ul className="list-disc pl-5 space-y-2 mt-3">
                  <li>Asignar un nivel de prioridad real (Baja, Media, Alta, Urgente).</li>
                  <li>Seleccionar a los técnicos correspondientes.</li>
                  <li>Vincular el Activo correcto para mantener su historial.</li>
                </ul>

                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-8 mb-3">2. Cambios de Estado</h3>
                <p>Una orden pasa por varios estados:</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-sm font-medium">EN PROCESO</span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-sm font-medium">EN ESPERA</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">FINALIZADO</span>
                </div>
                <p className="mt-3">El estado "EN ESPERA" se usa comúnmente cuando faltan refacciones o se requiere un paro de máquina.</p>
              </div>
            )}

            {/* Default fallback for other sections */}
            {activeSection !== 'intro' && activeSection !== 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center text-center py-20">
                <Wrench size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Sección en Construcción</h2>
                <p className="text-slate-500 dark:text-slate-400">Estamos documentando esta sección. Vuelve pronto para más detalles.</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};