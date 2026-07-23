import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, Wrench, Users, Shield, Package, LayoutDashboard, ArrowLeft, Terminal, AlertTriangle, CheckCircle2, Info, FileText, QrCode, Clock, Filter, Printer, Home, Activity, Bell, Smartphone, ClipboardCheck, Database, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  { id: 'intro', title: 'Introducción', icon: <BookOpen size={18} /> },
  { id: 'home', title: 'Inicio', icon: <Home size={18} /> },
  { id: 'dashboard', title: 'Órdenes de Trabajo', icon: <LayoutDashboard size={18} /> },
  { id: 'inventory', title: 'Inventario y Compras', icon: <Package size={18} /> },
  { id: 'assets', title: 'Activos (Maquinaria)', icon: <Wrench size={18} /> },
  { id: 'roles', title: 'Roles y Permisos', icon: <Shield size={18} /> },
  { id: 'users', title: 'Gestión de Personal', icon: <Users size={18} /> },
  { id: 'checklists', title: 'Checklist Diario', icon: <FileText size={18} /> },
  { id: 'roster', title: 'Horarios y Turnos', icon: <Clock size={18} /> },
];

export const UserManual = () => {
  const [activeSection, setActiveSection] = useState('intro');
  const [scrollFade, setScrollFade] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const sections = [...SECTIONS];
  if (user?.role === 'ADMINISTRADOR') {
    sections.push({ id: 'dev', title: 'Opciones de Desarrollador', icon: <Terminal size={18} /> });
  }

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setScrollFade(0);
    contentRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <BookOpen className="text-emerald-600 dark:text-emerald-400" size={32} />
            Manual de Usuario Interactivo
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Guía completa, detallada y paso a paso para dominar LPET CMMS.</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden md:flex-row md:gap-6">
        <div className="shrink-0 md:hidden ui-card overflow-hidden p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Temario de ayuda
          </p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionChange(section.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                  activeSection === section.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {section.icon}
                {section.title}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-3 flex w-full items-center justify-center gap-2 border-t border-slate-200 pt-3 text-sm font-bold text-slate-600 transition-colors hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
        </div>

        {/* Sidebar de navegación */}
        <div className="hidden h-full min-h-0 w-full shrink-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex md:w-72">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Temario de Ayuda</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => handleSectionChange(sec.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                  activeSection === sec.id
                    ? 'bg-emerald-600 text-white shadow-md transform scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:scale-[1.01]'
                }`}
              >
                {sec.icon}
                {sec.title}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
            >
              <ArrowLeft size={18} />
              Volver
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={contentRef}
            onScroll={(event) => setScrollFade(Math.min(event.currentTarget.scrollTop / 64, 1))}
            style={scrollFade > 0 ? {
              maskImage: `linear-gradient(to bottom, rgba(0, 0, 0, ${1 - scrollFade}) 0, black 64px)`,
              WebkitMaskImage: `linear-gradient(to bottom, rgba(0, 0, 0, ${1 - scrollFade}) 0, black 64px)`,
            } : undefined}
            className="h-full min-h-0 overflow-y-auto overscroll-contain pr-1 text-slate-700 dark:text-slate-300"
          >
            <div
              key={activeSection}
              className="max-w-4xl mx-auto space-y-10 pb-12 animate-in fade-in slide-in-from-right-8 duration-500 md:animate-none"
            >
            
            {activeSection === 'intro' && (
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
                <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-900 p-7 text-white shadow-lg dark:border-emerald-900 sm:p-9">
                  <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative">
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                      <BookOpen size={28} />
                    </div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Guía operativa de mantenimiento</p>
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Bienvenido a LPET CMMS</h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/90">
                      Una plataforma para registrar, ejecutar y comprobar el mantenimiento de planta:
                      desde el primer reporte de una falla hasta su solución, consumo de refacciones,
                      evidencia técnica y análisis de resultados.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { icon: <Activity size={21} />, title: 'Rapidez', text: 'Reporta, asigna y consulta órdenes sin depender de formatos separados.' },
                    { icon: <Database size={21} />, title: 'Trazabilidad', text: 'Conserva responsables, fechas, tiempos, firmas, refacciones y evidencia.' },
                    { icon: <Shield size={21} />, title: 'Control', text: 'Permisos por rol y acciones críticas protegidas para cuidar la información.' },
                  ].map((pillar) => (
                    <div key={pillar.title} className="ui-card p-5">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        {pillar.icon}
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{pillar.title}</h3>
                      <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{pillar.text}</p>
                    </div>
                  ))}
                </div>

                <div className="ui-card overflow-hidden" >
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cómo fluye el trabajo en el sistema</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">El CMMS conecta cada etapa para evitar información aislada.</p>
                  </div>
                  <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { n: '1', icon: <Bell size={18} />, title: 'Reportar', text: 'Se registra la solicitud, activo, zona y prioridad.' },
                      { n: '2', icon: <Users size={18} />, title: 'Asignar', text: 'Se designan técnicos y se inicia el seguimiento.' },
                      { n: '3', icon: <Wrench size={18} />, title: 'Ejecutar', text: 'Se documentan tiempos, pausas, refacciones y solución.' },
                      { n: '4', icon: <ClipboardCheck size={18} />, title: 'Comprobar', text: 'Se cierra con evidencia y alimenta historial y KPIs.' },
                    ].map((step) => (
                      <div key={step.n} className="relative rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                        <span className="absolute right-3 top-3 text-2xl font-black text-slate-100 dark:text-slate-800">{step.n}</span>
                        <div className="mb-3 text-emerald-600 dark:text-emerald-400">{step.icon}</div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{step.title}</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{step.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Qué puedes hacer según tu función</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/50 dark:bg-sky-950/20">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300">
                        <Smartphone size={20} />
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Solicitante</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reporta una necesidad desde el Portal de Solicitudes y recibe seguimiento.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
                        <Wrench size={20} />
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Técnico</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Consulta sus órdenes, registra trabajo, pausas, consumos y cierre técnico.</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
                        <LayoutDashboard size={20} />
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Gestión / Administración</h4>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Prioriza, asigna, administra catálogos y analiza cumplimiento, costos y fallas.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/30 dark:bg-blue-900/10">
                  <h3 className="mb-2 flex items-center gap-2 font-bold text-blue-900 dark:text-blue-300">
                    <Info size={18} /> ¿Cómo leer este manual?
                  </h3>
                  <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400/90">
                    <li>• Elige un tema en el temario. En celular, toca una opción de la barra superior; el contenido entrará desde la derecha.</li>
                    <li>• Los pasos numerados indican el orden recomendado de uso.</li>
                    <li>• Las alertas rojas identifican acciones destructivas o que requieren confirmación.</li>
                    <li>• Los nombres de menús y botones aparecen en <strong>negritas</strong> para encontrarlos rápido.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'home' && (
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Home size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Inicio</h2>
                </div>

                <p className="text-slate-600 dark:text-slate-400">
                  El módulo <strong>Inicio</strong> muestra el resumen operativo del mantenimiento: gráfico Pareto de problemas frecuentes, filtro de fechas, tarjetas por estado y la relación de tipos de mantenimiento.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-5 rounded-2xl">
                  <p className="text-sm text-blue-900 dark:text-blue-300 leading-relaxed">
                    Al hacer clic en una tarjeta (Pendientes, En Proceso, etc.) se abre <strong>Órdenes de Trabajo</strong> con ese filtro ya aplicado, para pasar del panorama general al detalle de las solicitudes.
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 p-5 rounded-2xl">
                  <p className="text-sm text-emerald-900 dark:text-emerald-300 leading-relaxed">
                    Más abajo verás el <strong>resumen de órdenes finalizadas de la semana actual</strong> (de Lunes a Domingo): total, gráfica diaria y listado. También puedes abrir el detalle desde la campana de notificaciones.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'dashboard' && (
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
                <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 pb-6">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <LayoutDashboard size={28} />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Órdenes de Trabajo</h2>
                </div>

                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                    El Ciclo de Vida de una Orden
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Las Órdenes de Trabajo (OT) son el núcleo de CMMS. Su ciclo de vida garantiza que una falla sea rastreada desde que se reporta hasta que se soluciona. En este módulo gestionas las solicitudes con Vista General, Mis Órdenes e Historial.
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
                      <p className="text-sm text-slate-600 dark:text-slate-400">El trabajo terminó. Antes de guardar puedes registrar <strong>repuestos a descontar</strong>; el stock baja al cerrar y el costo queda ligado a la OT.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                    Aceptar y Autoasignarse una Orden
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Un Administrador o Gestionador también puede atender solicitudes. Abre una orden <strong>Pendiente</strong>, elige <strong>Aceptar orden</strong> en el estado y sube la fotografía de evidencia “Antes”.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-5 rounded-2xl">
                    <p className="text-sm text-blue-900 dark:text-blue-300 leading-relaxed">
                      Si no seleccionas a nadie en <strong>Técnicos Asignados</strong>, la orden se asignará automáticamente a tu usuario al guardarla. Si otra persona atenderá el trabajo, selecciónala antes de guardar. Administradores y Gestionadores conservan estos controles; los Técnicos no pueden modificar la asignación.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                    Filtros y Búsquedas Avanzadas
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    No pierdas tiempo navegando entre páginas. Órdenes de Trabajo cuenta con herramientas para encontrar exactamente la orden que necesitas. Además, en cualquier pantalla puedes usar <strong>Ctrl/Cmd+K</strong> (o la lupa en celular) para buscar activos, repuestos, ubicaciones y folios <strong>FOL-####</strong> en un solo lugar.
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

                <div className="space-y-4 pt-4">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
                    SLA (Acuerdo de Nivel de Servicio) y Escalamiento
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    El sistema vigila tres relojes por prioridad (Urgente / Normal / Bajo): <strong>respuesta</strong> (mientras está Pendiente), <strong>detenida</strong> (En Espera) y <strong>resolución</strong> (hasta el cierre).
                  </p>
                  <ul className="list-none space-y-3 mt-4">
                    <li className="flex items-start gap-3">
                      <Clock className="text-amber-500 shrink-0 mt-1" size={18} />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200 block">Recordatorios y escalamiento</strong>
                        <span className="text-sm text-slate-500">Cada 15 minutos se evalúan las OT abiertas. Al cruzar umbrales se avisa por Telegram y por la campana; el escalamiento llega a Gestionadores y Administradores. Cada aviso se envía una sola vez por orden. El rezago histórico no satura el grupo (arranque silencioso) y, si hay muchos avisos nuevos, se manda un solo resumen.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Settings className="text-emerald-500 shrink-0 mt-1" size={18} />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200 block">Configuración</strong>
                        <span className="text-sm text-slate-500">En Configuración → SLA (Acuerdo de Nivel de Servicio) puedes activar el seguimiento y editar con un formulario (por prioridad) las horas de recordatorio, máximo y escalamiento. En el listado verás badges: Dentro de SLA, En riesgo o Vencido.</span>
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
                      Si un operador escanea un código QR en la planta y levanta un reporte desde su celular, <strong>la orden aparecerá en Órdenes de Trabajo sin que tengas que recargar la página</strong>. Lo mismo aplica a inventario, activos, compras y el resto de módulos: los cambios de otros usuarios llegan casi al momento. Además, si dos personas abren la <strong>misma OT</strong>, la primera puede editarla y la segunda la ve en solo lectura con el aviso <strong>«En edición por…»</strong> hasta que se cierre el detalle.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'inventory' && (
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
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
                      <AlertTriangle className="text-rose-500" size={20} /> Alertas de Stock Crítico (accionables)
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Al crear una refacción defines un <strong>Stock Mínimo</strong>. Cuando el stock llega a ese nivel (o baja), la tarjeta superior de <strong>Stock Crítico</strong> muestra la cantidad. Un clic en la tarjeta filtra la lista de repuestos; con permiso de compras, el botón <strong>Generar borrador OC</strong> crea Órdenes de Compra en estado Borrador (una por proveedor, con la cantidad faltante para volver al mínimo). Los ítems sin proveedor se omiten y se te avisan. Luego revisas y avanzas el flujo en <strong>Órdenes de Compra</strong>.
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

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <QrCode className="text-indigo-500" size={20} /> Búsqueda e impresión QR masiva
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Las pestañas <strong>Repuestos</strong> y <strong>Ubicaciones</strong> incluyen <strong>QR masivo</strong>. Actívalo, selecciona registros individualmente o elige todos los resultados filtrados y pulsa Imprimir para generar una hoja de etiquetas. Cada registro conserva además su botón individual de QR; al escanear una ubicación, la app abre su detalle y los repuestos asociados.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'assets' && (
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
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
                      <li><strong>Código Interno:</strong> Se autoasigna al guardar con formato <strong>MTTO-NNNN-S-DDD-T</strong> (ej. <code className="text-xs">MTTO-0052-B-001-F</code>). No se escribe manualmente; se regenera si cambias nombre, zona, sección o tipo fijo/controlable.</li>
                      <li><strong>Tipo de activo:</strong> Obligatorio — <strong>Activo fijo (F)</strong> o <strong>Controlable (C)</strong>.</li>
                      <li><strong>Nombre:</strong> Descripción clara de la máquina.</li>
                      <li><strong>Zona:</strong> Área de la planta donde está ubicada (Ej. L3, Empaque). En L1–L5 también pides <strong>Sección A–E</strong>.</li>
                    </ul>
                  </div>

                  <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
                    <QrCode size={48} className="text-cyan-400 mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Escaneo y QR masivo</h3>
                    <p className="text-sm text-slate-400">
                      Cada máquina tiene un QR único. Al escanearlo se abre el expediente con la pestaña <strong>De un vistazo</strong> (últimas OTs, RCA, PMs, stock crítico y costo). Con <strong>QR masivo</strong> puedes seleccionar varios activos o ubicaciones e imprimir una hoja de etiquetas de una vez.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-5 rounded-2xl mt-6">
                  <h3 className="font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                    <Shield size={18} /> Código Interno Automático (MTTO)
                  </h3>
                  <p className="text-amber-800 dark:text-amber-400/90 text-sm">
                    El código se genera al guardar con formato <code className="text-xs bg-amber-100 dark:bg-amber-950 px-1 rounded">MTTO-NNNN-S-DDD-T</code>
                    (NNNN por nombre de equipo, S = sección A–E o X, DDD = duplicado en la misma zona con el mismo nombre, T = F fijo / C controlable).
                    No se escribe a mano. Si editas nombre, zona, sección o tipo, el sistema lo regenera; si solo cambias otros campos, se conserva.
                    Los códigos antiguos <code className="text-xs bg-amber-100 dark:bg-amber-950 px-1 rounded">ACT-XXXX</code> se mantienen hasta una edición que regenere.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'roles' && (
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
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
                      <span className="text-sm text-slate-600 dark:text-slate-400">Supervisores o Planeadores. Pueden asignar tareas, aprobar y acceder a Configuración (excepto Roles y Permisos).</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-green-100 text-green-700 font-bold text-xs rounded-full min-w-[120px] text-center">TECNICO</span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">Personal de campo. Cierran órdenes, consumen inventario y consultan el Árbol de Fallas, pero no lo editan ni ven Configuración.</span>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 p-5 rounded-2xl mt-8">
                  <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">Árbol de Fallas y Configuración</h3>
                  <p className="text-indigo-800 dark:text-indigo-400/90 text-sm leading-relaxed">
                    Todos los roles pueden <strong>ver</strong> el Árbol de Fallas. Solo Administrador y Gestionador pueden <strong>editarlo</strong>. El módulo de Configuración aparece para Administrador y Gestionador; el Técnico no lo ve.
                  </p>
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
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
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
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
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
                      La interfaz es un formulario masivo donde puedes marcar rápidamente si sistemas como Lubricación, Neumática, y Eléctrica están <strong className="text-green-600">OK</strong>, <strong className="text-red-500">NOK (Falla)</strong> o N/A. Si marcas algo como NOK, tienes un campo de texto obligatorio para describir el problema detectado. Algunas tareas piden un <strong>número</strong> (temperaturas) o un <strong>texto</strong> (lecturas de agua) en lugar del check.
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <Settings className="text-indigo-500" size={20} /> Catálogo: Check, Número, Texto y columnas
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      En <strong>Configuración → Catálogo de Checklist</strong>, cada pregunta tiene un selector para el tipo de respuesta: <strong>Check</strong> (OK/Falla/N/A), <strong>Número</strong> o <strong>Texto</strong>. Además puedes definir el <strong>número de columnas</strong> (máquinas L1…Ln, hasta 12). Si agregas una línea, sube ese número y el próximo checklist diario ya la incluirá.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'roster' && (
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
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
              <div className="space-y-8 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
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
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-red-400" size={16} /> Dado que tu usuario será eliminado, la app cierra la sesión y te lleva al login con un aviso explicando qué ocurrió.</li>
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-red-400" size={16} /> Para que el sistema no se quede bloqueado permanentemente (sin usuarios para entrar), el sistema inyecta un salvavidas final: creará un usuario administrador base (`admin@fiix.com` / `password123`); al entrar te pedirá cambiar la contraseña.</li>
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
                  
                  <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20 mb-4">
                    <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm uppercase tracking-wider mb-3">¿Qué son estas credenciales?</h4>
                    <ul className="space-y-3 text-sm text-blue-800/80 dark:text-blue-300/80">
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-blue-400" size={16} /> <strong>Bot Token:</strong> Llave maestra del bot (formato largo, ej. <code className="text-xs bg-blue-100 dark:bg-blue-950 px-1 rounded">123456:ABC-DEF...</code>). La otorga <em>@BotFather</em>.</li>
                      <li className="flex gap-2 items-start"><CheckCircle2 className="shrink-0 mt-0.5 text-blue-400" size={16} /> <strong>Chat ID:</strong> Identificador numérico del grupo donde deben llegar las alertas (suele ser negativo, ej. <code className="text-xs bg-blue-100 dark:bg-blue-950 px-1 rounded">-1001234567890</code>).</li>
                      <li className="flex gap-2 items-start"><Info className="shrink-0 mt-0.5 text-blue-400" size={16} /> <strong>Prioridad:</strong> Lo que guardes aquí reemplaza el `.env`. Para volver al valor del servidor, borra ambos campos y pulsa Guardar.</li>
                    </ul>
                  </div>

                  <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20 mb-4">
                    <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm uppercase tracking-wider mb-3">A) Configuración nueva (crear bot y grupo desde cero)</h4>
                    <ol className="list-decimal pl-5 space-y-3 text-sm text-blue-800/80 dark:text-blue-300/80">
                      <li>
                        <strong>Crear el bot:</strong> En Telegram busca <em>@BotFather</em> → envía <code className="text-xs bg-blue-100 dark:bg-blue-950 px-1 rounded">/newbot</code> → elige nombre y username (debe terminar en <code className="text-xs">bot</code>).
                        BotFather te devolverá el <strong>Bot Token</strong>. Cópialo y guárdalo.
                      </li>
                      <li>
                        <strong>Crear el grupo:</strong> Crea un grupo de Telegram (ej. “MTTO Alertas”) e invita a los técnicos/administradores que deban ver avisos.
                      </li>
                      <li>
                        <strong>Agregar el bot al grupo:</strong> Añade tu bot como miembro del grupo. Conviene darle permiso para enviar mensajes.
                      </li>
                      <li>
                        <strong>Obtener el Chat ID del grupo:</strong>
                        <ul className="list-disc pl-5 mt-2 space-y-1.5">
                          <li>Opción recomendada: agrega temporalmente el bot <em>@RawDataBot</em> o <em>@userinfobot</em> al grupo; te mostrará un campo <code className="text-xs">chat.id</code> (número negativo). Cópialo y luego puedes quitar ese bot auxiliar.</li>
                          <li>Otra opción: envía cualquier mensaje en el grupo y abre en el navegador:
                            <code className="block text-xs bg-blue-100 dark:bg-blue-950 px-2 py-1.5 rounded mt-1 break-all">https://api.telegram.org/bot&lt;TU_TOKEN&gt;/getUpdates</code>
                            Busca <code className="text-xs">"chat":{"{"}"id": ...{"}"}</code> del grupo.
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>Pegar en CMMS:</strong> Ve a <em>Configuración → Opciones de Desarrollador</em> (contraseña maestra) → sección Telegram → pega <strong>Bot Token</strong> y <strong>Chat ID</strong> → Guardar. Activa también “Alertas por Telegram” en Notificaciones si está apagado.
                      </li>
                      <li>
                        <strong>Probar:</strong> Crea una solicitud de prueba desde el Portal o Nueva Orden; debe llegar un mensaje al grupo.
                      </li>
                    </ol>
                  </div>

                  <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20">
                    <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm uppercase tracking-wider mb-3">B) Ya lo tenían configurado pero olvidaron las claves</h4>
                    <ul className="space-y-3 text-sm text-blue-800/80 dark:text-blue-300/80">
                      <li className="flex gap-2 items-start">
                        <CheckCircle2 className="shrink-0 mt-0.5 text-blue-400" size={16} />
                        <span><strong>Bot Token olvidado:</strong> Abre chat con <em>@BotFather</em> → <code className="text-xs bg-blue-100 dark:bg-blue-950 px-1 rounded">/mybots</code> → selecciona tu bot → <em>API Token</em> → <em>Show token</em> (o <em>Revoke current token</em> si sospechas que se filtró; el token anterior dejará de servir y debes actualizarlo en CMMS).</span>
                      </li>
                      <li className="flex gap-2 items-start">
                        <CheckCircle2 className="shrink-0 mt-0.5 text-blue-400" size={16} />
                        <span><strong>Chat ID olvidado:</strong> No hace falta recrear el grupo. Con el bot aún dentro del grupo, usa de nuevo <em>@RawDataBot</em>/<em>@userinfobot</em> o el enlace <code className="text-xs">getUpdates</code> con tu token. El Chat ID del grupo no cambia mientras el grupo exista.</span>
                      </li>
                      <li className="flex gap-2 items-start">
                        <CheckCircle2 className="shrink-0 mt-0.5 text-blue-400" size={16} />
                        <span><strong>Revisar lo guardado en CMMS:</strong> En Opciones de Desarrollador, si alguien ya lo configuró, el Chat ID suele verse en claro; el Bot Token aparece oculto tipo contraseña. Puedes volver a pegar ambos valores y Guardar sin borrar el grupo.</span>
                      </li>
                      <li className="flex gap-2 items-start">
                        <Info className="shrink-0 mt-0.5 text-blue-400" size={16} />
                        <span><strong>Si el bot ya no está en el grupo:</strong> vuelve a agregarlo, envía un mensaje de prueba al grupo y vuelve a consultar <code className="text-xs">getUpdates</code> o el bot de info.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Default fallback for other sections */}
            {activeSection !== 'intro' && activeSection !== 'home' && activeSection !== 'dashboard' && activeSection !== 'roles' && activeSection !== 'users' && activeSection !== 'inventory' && activeSection !== 'assets' && activeSection !== 'checklists' && activeSection !== 'roster' && activeSection !== 'dev' && (
              <div className="flex flex-col items-center justify-center text-center py-24 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 md:animate-in md:fade-in md:slide-in-from-bottom-4 md:duration-500">
                <Wrench size={56} className="text-slate-300 dark:text-slate-600 mb-6" />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">Sección en Construcción</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">Nuestros ingenieros de documentación están redactando esta sección. Vuelve pronto para explorar los detalles.</p>
              </div>
            )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};