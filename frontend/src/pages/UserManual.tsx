import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, Menu, Wrench, Users, Shield, Package, LayoutDashboard, ArrowLeft, Terminal, AlertTriangle, CheckCircle2, Info, FileText, QrCode, Clock, Filter, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  { id: 'intro', title: 'Introducción', icon: <BookOpen size={18} /> },
  { id: 'dashboard', title: 'Dashboard y Órdenes', icon: <LayoutDashboard size={18} /> },
  { id: 'inventory', title: 'Inventario y Compras', icon: <Package size={18} /> },
  { id: 'assets', title: 'Activos (Maquinaria)', icon: <Wrench size={18} /> },
  { id: 'roles', title: 'Roles y Permisos', icon: <Shield size={18} /> },
  { id: 'users', title: 'Gestión de Personal', icon: <Users size={18} /> },
  { id: 'checklists', title: 'Checklist Diario', icon: <FileText size={18} /> },
  { id: 'roster', title: 'Horarios y Turnos', icon: <Clock size={18} /> },
];

export const UserManual = () => {
  const [activeSection, setActiveSection] = useState('intro');
  const navigate = useNavigate();
  const { user } = useAuth();

  const sections = [...SECTIONS];
  if (user?.role === 'ADMINISTRADOR') {
    sections.push({ id: 'dev', title: 'Opciones de Desarrollador', icon: <Terminal size={18} /> });
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <BookOpen className="text-blue-600 dark:text-blue-400" size={32} />
            Manual de Usuario Interactivo
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Guía completa, detallada y paso a paso para dominar LPET CMMS.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mt-4">
        
        {/* Sidebar de navegación */}
        <div className="w-full md:w-72 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col shrink-0 h-fit sticky top-24">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Temario de Ayuda</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                  activeSection === sec.id
                    ? 'bg-blue-600 text-white shadow-md transform scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:scale-[1.01]'
                }`}
              >
                {sec.icon}
                {sec.title}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 text-slate-700 dark:text-slate-300">
          <div className="max-w-4xl mx-auto space-y-10 pb-12">
            
            {activeSection === 'intro' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-blue-500/30">
                  <BookOpen size={40} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">Bienvenido a LPET CMMS</h2>
                
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                    El Sistema de Gestión de Mantenimiento Asistido por Computadora (CMMS) de LPET ha sido diseñado bajo tres pilares fundamentales: <strong>Rapidez, Trazabilidad y Seguridad</strong>.
                  </p>
                  <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400 mt-4">
                    Nuestro objetivo es abandonar las hojas de cálculo y los formatos de papel para centralizar todas las operaciones de mantenimiento de tu planta en un entorno digital inteligente. Cada refacción, cada falla y cada técnico dejan una huella digital auditable en tiempo real.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
                      <LayoutDashboard size={20} />
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2">Diseño Intuitivo</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Menos clics y navegación fluida. Todo está a uno o dos pasos de distancia.</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
                      <Shield size={20} />
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-2">Datos Protegidos</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Controles de permisos granulares para asegurar que cada usuario vea solo lo que le corresponde.</p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-5 rounded-2xl mt-8">
                  <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <Info size={18} /> ¿Cómo leer este manual?
                  </h3>
                  <p className="text-blue-800 dark:text-blue-400/90 text-sm">
                    Utiliza la barra lateral para explorar en detalle cada rincón del sistema. Las funciones destructivas o críticas estarán marcadas en rojo para tu seguridad.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <LayoutDashboard size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Dashboard y Órdenes</h2>
                </div>

                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                    El Ciclo de Vida de una Orden
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Las Órdenes de Trabajo (OT) son el núcleo de CMMS. Su ciclo de vida garantiza que una falla sea rastreada desde que se reporta hasta que se soluciona.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="border border-slate-200 dark:border-slate-700 p-4 rounded-2xl">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-bold mb-3 inline-block">EN PROCESO</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">La orden ha sido creada y los técnicos están trabajando activamente en ella.</p>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-700 p-4 rounded-2xl">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-xs font-bold mb-3 inline-block">EN ESPERA</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">El trabajo está pausado, usualmente esperando una refacción o autorización externa.</p>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-700 p-4 rounded-2xl">
                      <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold mb-3 inline-block">FINALIZADO</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">El trabajo terminó y la máquina opera con normalidad. Requiere firma del técnico.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                    Filtros y Búsquedas Avanzadas
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    No pierdas tiempo navegando entre páginas. El Dashboard cuenta con herramientas para encontrar exactamente la orden que necesitas.
                  </p>
                  <ul className="list-none space-y-3 mt-4">
                    <li className="flex items-start gap-3">
                      <Filter className="text-blue-500 shrink-0 mt-1" size={18} />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200 block">Ordenamiento Cronológico</strong>
                        <span className="text-sm text-slate-500">Alterna entre "Más recientes primero" (para el día a día) o "Más antiguos primero" (para limpiar el rezago).</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Filter className="text-blue-500 shrink-0 mt-1" size={18} />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200 block">Filtro por Prioridad</strong>
                        <span className="text-sm text-slate-500">Haz clic en el filtro para aislar únicamente las órdenes catalogadas como "Urgentes" o "Altas".</span>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 p-5 rounded-2xl mt-8 flex gap-4 items-start">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-full shrink-0">
                    <CheckCircle2 className="text-emerald-600 dark:text-emerald-300" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-900 dark:text-emerald-300 mb-1">WebSockets: Magia en Tiempo Real</h3>
                    <p className="text-emerald-800 dark:text-emerald-400/90 text-sm leading-relaxed">
                      Si un operador escanea un código QR en la planta y levanta un reporte desde su celular, <strong>la orden aparecerá mágicamente en tu Dashboard sin que tengas que recargar la página</strong>. Esto es gracias a nuestra arquitectura de WebSockets bidireccionales.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'inventory' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                    <Package size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Inventario y Compras</h2>
                </div>

                <p className="text-lg text-slate-600 dark:text-slate-400">
                  Controlar el almacén de refacciones es vital para reducir los tiempos muertos (MTTR). Si la pieza no está, la máquina no produce.
                </p>

                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <Search className="text-amber-500" size={20} /> Catálogo Inteligente
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      Cada refacción tiene un Número de Parte, Marca, Modelo y Ubicación Física (Ej. Estante A3, Nivel 2). Pero la característica estrella es su <strong>Integración Web</strong>: si dejas la imagen en blanco, nuestro motor (Puppeteer) buscará y descargará automáticamente la imagen de la refacción desde internet usando su número de parte.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <AlertTriangle className="text-rose-500" size={20} /> Alertas de Stock (Reorden)
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Al crear una refacción defines un "Stock Mínimo". Cuando los técnicos consumen piezas en sus órdenes de trabajo, el sistema resta ese inventario matemáticamente de forma automática. Si llega al mínimo, la pieza se marca en rojo intenso alertando al comprador que es momento de reabastecer.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <Package className="text-amber-500" size={20} /> Ver Detalle desde Categorías, Ubicaciones y Proveedores
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Al abrir el detalle de una <strong>Categoría</strong>, <strong>Ubicación</strong> o <strong>Proveedor</strong> (pestañas dentro de Inventario), verás la lista de "Repuestos Asociados" a ese registro. Haz clic sobre cualquier repuesto de esa lista para abrir directamente su ficha completa de detalle, la misma vista que obtienes al abrirlo desde la pestaña de "Repuestos".
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'assets' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-xl">
                    <Wrench size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Gestión de Activos</h2>
                </div>

                <p className="text-lg text-slate-600 dark:text-slate-400">
                  Los Activos representan las máquinas, edificios, vehículos o equipos que reciben mantenimiento. Sin un buen catálogo de activos, las métricas y los costos no tienen sentido.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Campos Obligatorios</h3>
                    <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                      <li><strong>Código (Asset Tag):</strong> Un ID único irrepetible (Ej. M-01).</li>
                      <li><strong>Nombre:</strong> Descripción clara de la máquina.</li>
                      <li><strong>Zona:</strong> Área de la planta donde está ubicada (Ej. Producción Línea 1, Empaque).</li>
                    </ul>
                  </div>

                  <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
                    <QrCode size={48} className="text-cyan-400 mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Escaneo Rápido (QR)</h3>
                    <p className="text-sm text-slate-400">
                      El CMMS genera un QR único para cada máquina. Imprímelo, pégalo en el chasis físico y permite que tus técnicos o solicitantes lo escaneen para abrir su expediente al instante sin teclear nada.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'roles' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                    <Shield size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Roles y Permisos</h2>
                </div>

                <p className="text-lg text-slate-600 dark:text-slate-400">
                  La seguridad es primordial. El módulo de permisos te otorga control granular (casi quirúrgico) sobre lo que cada usuario puede hacer, leer, editar o eliminar.
                </p>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mt-6">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Los 3 Roles Base</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-red-100 text-red-700 font-bold text-xs rounded-full min-w-[120px] text-center">ADMINISTRADOR</span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">Control absoluto y total del sistema.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 font-bold text-xs rounded-full min-w-[120px] text-center">GESTIONADOR</span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">Supervisores o Planeadores. Pueden asignar tareas y aprobar, pero no configurar el sistema.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-green-100 text-green-700 font-bold text-xs rounded-full min-w-[120px] text-center">TECNICO</span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">Personal de campo. Cierran órdenes, consumen inventario, pero no pueden borrar activos ni usuarios.</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-5 rounded-2xl mt-8">
                  <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <CheckCircle2 size={18} /> Autoguardado Inteligente
                  </h3>
                  <p className="text-blue-800 dark:text-blue-400/90 text-sm">
                    En la matriz de permisos no encontrarás un botón de "Guardar". Cada vez que enciendes (Toggle) o apagas un permiso para un rol específico, el sistema lo procesa, lo guarda en el servidor y muestra un pequeño indicador verde temporal. **Cero fricciones.**
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'users' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 rounded-xl">
                    <Users size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Gestión de Personal</h2>
                </div>

                <p className="text-lg text-slate-600 dark:text-slate-400">
                  Para mantener el sistema ordenado, LPET CMMS hace una división estricta entre quienes trabajan **dentro** del sistema y quienes solo lo usan para **pedir ayuda**.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Personal Interno</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Tienen usuario, contraseña y un Rol (Admin, Técnico). Pueden entrar al sistema, firmar, y ejecutar comandos según su jerarquía.
                    </p>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Solicitantes (Público)</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Operadores de máquinas o gerentes de producción que usan el portal público para levantar folios de falla. Solo guardamos su Nombre, Teléfono y Departamento.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-5 rounded-2xl mt-8">
                  <h3 className="font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                    <Shield size={18} /> Regla Anti-Borrado (Integridad Referencial)
                  </h3>
                  <p className="text-amber-800 dark:text-amber-400/90 text-sm">
                    No puedes "eliminar" a un técnico si este ya firmó órdenes de trabajo o sacó refacciones en el pasado. Si lo borras, la historia quedaría sin responsable. Para solucionar esto, la mejor práctica es editar al usuario y **desmarcar la casilla de Activo**. Esto lo ocultará de las listas para asignar turnos, pero mantendrá su firma en la historia.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'checklists' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <FileText size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Checklist Diario</h2>
                </div>

                <p className="text-lg text-slate-600 dark:text-slate-400">
                  Evaluar el estado general de las máquinas día a día previene fallas catastróficas. Este módulo digitaliza la clásica libreta de recorridos.
                </p>

                <div className="space-y-6 mt-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <Shield className="text-slate-500" size={20} /> Límite Estricto Diario
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      El sistema cuenta con un seguro preventivo: <strong>solo permite un checklist general por día</strong> para toda la planta. Si el turno de la mañana ya lo hizo, el botón "Crear" se desactiva y cambia a "Ver Checklist de Hoy". Esto centraliza las observaciones y evita información duplicada.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="text-emerald-500" size={20} /> Evaluaciones Rápidas
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      La interfaz es un formulario masivo donde puedes marcar rápidamente si sistemas como Lubricación, Neumática, y Eléctrica están <strong className="text-green-600">OK</strong>, <strong className="text-red-500">NOK (Falla)</strong> o N/A. Si marcas algo como NOK, tienes un campo de texto obligatorio para describir el problema detectado.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'roster' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Clock size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Horarios y Turnos (Roster)</h2>
                </div>

                <p className="text-lg text-slate-600 dark:text-slate-400">
                  Saber quién está en la planta hoy es esencial. Este módulo funciona como un calendario interactivo de la plantilla técnica.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Asignación de Patrones</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      En lugar de asignar días uno por uno, puedes asignar un patrón de repetición (Ej. Turno 4x4) y el sistema generará los bloques automáticos hacia el futuro.
                    </p>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Arrastrar y Soltar (Drag & Drop)</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      ¿Alguien faltó hoy o pidió vacaciones? Toma la etiqueta de incidencia de la barra lateral (Falta, Vacaciones, Tiempo Extra, TxT) y arrástrala sobre el día del calendario para registrarla.
                    </p>
                  </div>
                </div>

                <div className="bg-fuchsia-50 dark:bg-fuchsia-900/10 border border-fuchsia-200 dark:border-fuchsia-900/30 p-5 rounded-2xl mt-6">
                  <h3 className="font-bold text-fuchsia-900 dark:text-fuchsia-300 mb-2 flex items-center gap-2">
                    <BookOpen size={18} /> Días Festivos Autoprogramados
                  </h3>
                  <p className="text-fuchsia-800 dark:text-fuchsia-400/90 text-sm">
                    El calendario sombrea en color morado claro e impone un borde llamativo automáticamente sobre los días festivos nacionales de México (Ej. Año Nuevo, Día del Trabajo, Grito de Dolores).
                  </p>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 p-5 rounded-2xl mt-6">
                  <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
                    <Printer size={18} /> Impresión Inteligente PDF
                  </h3>
                  <p className="text-indigo-800 dark:text-indigo-400/90 text-sm mb-3">
                    El botón "Imprimir / PDF" no solo activa la impresora de tu navegador, sino que ejecuta reglas de diseño ocultas (CSS Print Media) diseñadas para exportar:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-indigo-800/80 dark:text-indigo-300/80">
                    <li>Oculta el menú lateral, los botones y la botonera propia del calendario para no gastar tinta en "basura visual".</li>
                    <li>Fija la altura a 650px exactos para que la vista del mes quepa perfectamente en una hoja A4 Horizontal sin salir partida a la mitad.</li>
                    <li>Reduce inteligentemente las etiquetas (9px) para garantizar que si hay más de 8 personas en un día, quepan todos sin que se oculte ninguno tras un botón "+X más".</li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'dev' && user?.role === 'ADMINISTRADOR' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex items-center gap-4 mb-6 border-b border-red-200 dark:border-red-900/50 pb-6">
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                    <Terminal size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Opciones de Desarrollador</h2>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-6 rounded-2xl shadow-sm">
                  <h3 className="text-xl font-bold text-red-800 dark:text-red-300 mb-3 flex items-center gap-2">
                    <AlertTriangle size={24} className="animate-pulse" /> El Botón Rojo Nuclear
                  </h3>
                  <p className="text-red-700 dark:text-red-400/90 text-sm leading-relaxed mb-4">
                    Esta sección de sistema está encriptada detrás de una contraseña maestra por una razón. El botón <strong>"Vaciar Base de Datos"</strong> es un proceso de borrado absoluto y destructivo (TRUNCATE CASCADE).
                  </p>
                  
                  <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                    <h4 className="font-bold text-red-900 dark:text-red-200 text-sm uppercase tracking-wider mb-3">¿Qué sucede al ejecutarlo?</h4>
                    <ul className="space-y-3 text-sm text-red-800/80 dark:text-red-300/80">
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-red-400" size={16} /> Toda la historia (órdenes de años pasados), activos, inventario, catálogos, y configuraciones (roles, checklists, roster) se borra a nivel de disco de forma irreversible.</li>
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-red-400" size={16} /> Dado que tu usuario será eliminado, tu sesión actual se cortará abruptamente expulsándote a la pantalla de inicio de sesión.</li>
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-red-400" size={16} /> Para que el sistema no se quede bloqueado permanentemente (sin usuarios para entrar), el sistema inyecta un salvavidas final: creará un usuario administrador base (`admin` / `password123`).</li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-bold text-red-900 dark:text-red-200 text-sm uppercase tracking-wider mb-2">Casos de Uso Aceptables</h4>
                    <p className="text-sm text-red-800/80 dark:text-red-300/80">
                      Utiliza este botón <strong>únicamente</strong> después de haber realizado una Exportación de Respaldo JSON si deseas limpiar la base de datos para reimportarla en limpio; o si se va a hacer el lanzamiento oficial de la aplicación y se requiere borrar toda la data de pruebas.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-6 rounded-2xl shadow-sm">
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                    <Terminal size={24} /> Configuración Dinámica de Telegram
                  </h3>
                  <p className="text-blue-700 dark:text-blue-400/90 text-sm leading-relaxed mb-4">
                    Esta opción permite conectar el sistema con un Bot de Telegram para recibir alertas en tiempo real sobre nuevas solicitudes de mantenimiento, sin requerir acceso al código fuente o al servidor (`.env`). Especialmente útil si se instala el sistema en diferentes plantas.
                  </p>
                  
                  <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
                    <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm uppercase tracking-wider mb-3">¿Qué son estas credenciales?</h4>
                    <ul className="space-y-3 text-sm text-blue-800/80 dark:text-blue-300/80">
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-blue-400" size={16} /> <strong>Bot Token:</strong> Es la llave maestra que te otorga <em>@BotFather</em> en Telegram para que el sistema asuma el control del bot.</li>
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-blue-400" size={16} /> <strong>Chat ID:</strong> Es el identificador numérico del grupo de chat al que deseas que lleguen las alertas (por ejemplo, el grupo de los técnicos).</li>
                      <li className="flex gap-2 items-start"><Info className="shrink-0 mt-0.5 text-blue-400" size={16} /> <strong>Importante:</strong> Al guardar credenciales aquí, estas tendrán prioridad absoluta sobre el archivo `.env`. Si deseas regresar a la configuración por defecto del servidor, simplemente borra los campos y presiona Guardar.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Default fallback for other sections */}
            {activeSection !== 'intro' && activeSection !== 'dashboard' && activeSection !== 'roles' && activeSection !== 'users' && activeSection !== 'inventory' && activeSection !== 'assets' && activeSection !== 'checklists' && activeSection !== 'roster' && activeSection !== 'dev' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center text-center py-24 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Wrench size={56} className="text-slate-300 dark:text-slate-600 mb-6" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Sección en Construcción</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">Nuestros ingenieros de documentación están redactando esta sección. Vuelve pronto para explorar los detalles.</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};