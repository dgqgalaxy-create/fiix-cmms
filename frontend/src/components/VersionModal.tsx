import { X, Info, Rocket, Server, Shield, CheckCircle2, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const APP_VERSION = "1.30.9";

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionModal = ({ isOpen, onClose }: VersionModalProps) => {
  if (!isOpen) return null;

  const version = APP_VERSION;
  const updateDate = "21 de Julio, 2026";
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
    "Corrección: Al abrir el detalle de una OT se recarga desde el servidor (así se ven las fotos importadas por CSV/zip) y se muestran Antes/Después aunque la lista estuviera desactualizada.",
    "Corrección: Al importar fotos de OT se llenan también request_image_url (listado) además de antes/después; se evita que fallos de tiempo del CSV impidan mapear fotos.",
    "Corrección: El zip de fotos de órdenes se envía de forma compatible con servidores que aún no tenían el campo workOrderImagesZip (evita Unexpected field).",
    "Corrección: Importar CSV + zip de fotos de órdenes ya no falla con «Unexpected field»; el servidor acepta los campos de zip de forma flexible.",
    "Nuevo: Al importar CSV puedes adjuntar también el zip Formulario Solicitudes_Images.zip; se asignan FOTO ANTES / FOTO DESPUÉS a cada OT por FOLIO (las firmas se ignoran).",
    "Nuevo: En el detalle de un repuesto puedes pasar al anterior/siguiente de la lista filtrada con las flechas ← → del teclado (o los botones del encabezado).",
    "Corrección: El auto-deploy en Ubuntu ya no falla cuando npm ensucia package-lock.json: el workflow hace git restore antes del pull y update.sh usa npm ci.",
    "Corrección: El inventario ya estaba importado, pero la pantalla salía vacía porque fallaba la carga de movimientos (faltaban columnas work_order_id/unit_cost en la BD). Se aplicó la migración y la vista ya no se tumba si un catálogo falla.",
    "Corrección: Importar CSV + zip de fotos por Tailscale/nginx — progreso de subida, errores 413 claros, nginx con body 500M y timeouts largos (update.sh recuerda recargar nginx a mano).",
    "Nuevo: Al importar CSV puedes seleccionar un zip de fotos de repuestos desde tu laptop (en lugar de la carpeta data/Items_Images/ en el servidor); se descomprime temporalmente, se emparejan por Item ID (.Image.HHMMSS) y se copian a uploads/inventory.",
    "Corrección: El detalle de Proveedores (y Categorías/Ubicaciones) ya se adapta a la altura de la pantalla: el contenido y los repuestos asociados son desplazables y ya no se ocultan en pantallas bajas.",
    "Cambio: Las fotos de repuestos al importar CSV se leen de data/Items_Images/ (nombre exacto del export Fiix: MTTO-0001.Image.163526.png = Item ID + .Image.HHMMSS); se emparejan por los archivos reales de esa carpeta.",
    "Nuevo: Al importar CSV puedes asignar fotos de repuestos desde data/Items_Images/; se copian a uploads/inventory como la subida manual.",
    "Cambio: Se eliminó la herramienta «Migrar códigos de activos → ACT-0001» de Opciones de Desarrollador (obsoleta: los activos nuevos y la importación CSV ya generan ACT-XXXX y el código no es editable).",
    "Cambio: Se eliminó el respaldo JSON (exportar/importar). Solo queda el respaldo del servidor: Crear respaldo / Restaurar respaldo (pg_dump + uploads).",
    "Cambio: Se eliminó el atajo «Mi día» del técnico. La barra inferior vuelve a «Mis OT» y muestra todas las órdenes abiertas asignadas (pendientes, en proceso y en espera).",
    "Mejora: En Opciones de Desarrollador, tras desbloquear con la contraseña maestra la sesión permanece abierta unos 5 minutos si sales y vuelves a entrar; pasado ese tiempo se pide de nuevo.",
    "Corrección crítica: Restaurar/crear respaldo del servidor fallaba con dumps vacíos (~20 B) porque PostgreSQL 15+ rechaza el parámetro Prisma `?schema=` en la URI de pg_dump/psql; ahora se limpia la URL, se rechazan respaldos vacíos, se recrea el schema al restaurar y el modal muestra el error en español sin cerrar sesión si falla.",
    "Mejora: Tras vaciar la BD (o restaurar un respaldo) en Opciones de Desarrollador se cierra la sesión y en el login aparece un aviso claro con las credenciales del admin recreado (`admin@fiix.com` / `password123`).",
    "Corrección: Tras borrar la base en Opciones de Desarrollador, el admin de emergencia vuelve a ser `admin@fiix.com` / `password123` (igual que el seed y la pista del login), no `admin`.",
    "Nuevo: Restaurar respaldo del servidor desde Opciones de Desarrollador (lista fiix_*.sql.gz, confirma «RESTAURAR», restaura BD y opcionalmente uploads). También scripts/restore.sh en Ubuntu.",
    "Nuevo: Tras importar usuarios por CSV o usar cuentas seed, al iniciar sesión con contraseña temporal se obliga a cambiarla antes de usar la app.",
    "Mejora: Mensajes offline más claros: sincronización completa (N cambios), fallos parciales con motivo breve (401, 409, red) y opciones Reintentar/Descartar; ya no se queda en «Sincronizando…» sin progreso.",
    "Nuevo: Acceso sin :3000 en Ubuntu con nginx (puerto 80 → Express :3000, WebSocket/Socket.IO); plantilla en deploy/nginx-fiix.conf e instalación opcional desde install.sh.",
    "Nuevo: Vigilancia de salud (API + Postgres) con alertas Telegram: cron externo scripts/healthcheck.sh cada 5 min y autocomprobación de BD dentro del backend; sin spam (solo al caer y recordatorio cada 6 h).",
    "Mejora: /api/health incluye db: ok|error; resolveBackendUrl trata puerto 80/443 vacío como mismo origen (nginx).",
    "Corrección: Crear respaldo en Opciones de Desarrollador ya funciona en Windows (ya no depende de /bin/bash); usa pg_dump y tar de forma nativa y busca pg_dump en rutas típicas de PostgreSQL.",
    "Corrección: El deploy fallaba en GitHub Actions porque el bundle JS (~2.5 MB) superaba el límite PWA de Workbox (2 MB); se subió el límite de precache a 5 MB.",
    "Corrección: La cola offline ya no encola fallos de red estando online ni re-encola al sincronizar (se eliminaron interceptores globales conflictivos); el sync usa auth actual, descarta 4xx y entradas tras 5 reintentos, y no bloquea las listas. Puedes vaciar la cola con «Descartar» en el aviso o en Opciones de Desarrollador.",
    "Corrección: `update.sh` ya compila el frontend y reinicia solo `fiix-backend` (UI+API en :3000); elimina el proceso legado `fiix-frontend` en :5173 que rompía el modelo same-origin de producción.",
    "Corrección: Despliegue con GitHub Actions (self-hosted): `update.sh` ya no falla solo por nvm ausente en shells no interactivos; detecta Node/npm/pm2 del PATH o carga nvm desde varias rutas, y el workflow hace `git pull` antes de ejecutar el script.",
    "Nuevo: Modo offline para técnicos: aceptar, pausar, finalizar y reanudar una OT ahora funciona sin conexión (se guarda en el dispositivo y se sincroniza solo al recuperar señal); si intentas subir fotos sin conexión, el sistema avisa y guarda el estado/notas sin las imágenes.",
    "Nuevo: Aviso de conexión con el número de cambios pendientes de sincronizar, visible en toda la app mientras estés sin señal o sincronizando.",
    "Nuevo: Respaldo automático diario (2:15 AM) de la base de datos y de las fotos/evidencias (uploads), con retención de 14 días; también puedes generarlo manualmente con el botón «Crear respaldo» en Opciones de Desarrollador.",
    "Nuevo: La contraseña maestra de Opciones de Desarrollador ahora se puede cambiar desde la propia app (queda protegida en la base de datos); ya no depende únicamente de editar el archivo `.env` del servidor.",
    "Mejora: En producción, el backend sirve la interfaz ya compilada en el mismo puerto que la API (un solo proceso en :3000); `install.sh`/`update.sh` compilan el frontend y ya no levantan un proceso PM2 aparte para la UI.",
    "Mejora: La URL del backend se resuelve automáticamente respetando HTTPS y el mismo origen del sitio (soporta accesos por Tailscale u otros proxies con certificado, además de HTTP normal).",
    "Mejora: install.sh pregunta al final por PM2 al reiniciar, firewall ufw, Telegram y Tailscale (todo opcional); el README documenta cada decisión.",
    "Docs: Manual, roadmap, contexto y README alineados con la app (install/update, RCA opcional, Inicio vs KPIs, sin datos obsoletos).",
    "Mejora: update.sh endurecido (falla si algo sale mal, comprueba .env/nvm/PM2, recrea el frontend con acceso en red y verifica que :3000 y :5173 respondan).",
    "Nuevo: Script install.sh para montar FIIX en un Ubuntu limpio (Node, PostgreSQL, .env, Prisma, PM2); update.sh sigue siendo solo para actualizaciones.",
    "Mejora: Vite acepta acceso por Tailscale MagicDNS (*.ts.net) además del hostname local lpet-cmms.",
    "Corrección: Al escanear el QR de una ubicación (p. ej. E2-0) ahora abre el detalle con sus repuestos; también acepta códigos sin prefijo FIIX-LOCATION y espera a que cargue el inventario antes de resolver el enlace.",
    "Corrección: Escáner QR en celular por IP (HTTP): ya no tumba la app al cerrar; si la cámara en vivo está bloqueada, puedes escanear eligiendo una foto de la galería. La cámara en vivo requiere HTTPS.",
    "Corrección: El escáner QR desde la barra de técnico ya no falla al abrir/cerrar la cámara (error «scanner is not running»).",
    "Nuevo: Capas móvil para técnicos: barra inferior (Mis OT, Escanear, Inventario, Inicio) y acciones rápidas Aceptar/Pausar/Finalizar/Reanudar en el detalle de la OT. Administradores y gestionadores conservan la interfaz completa.",
    "Mejora: Al abrir la app de cero (nueva sesión), entra en Inicio y no en Órdenes de Trabajo; los enlaces profundos a una OT o activo se respetan.",
    "Mejora: Las órdenes con foto ahora muestran el fondo fotográfico progresivo también en la tabla web de escritorio; en todas las vistas la imagen es 10% más visible sin comprometer la lectura.",
    "Corrección: En celular, al revisar el detalle de una orden en Órdenes de Trabajo, el botón o gesto Atrás cierra el modal y te deja en el listado (ya no salta a Inicio).",
    "Mejora: En celular y tablet, las tarjetas de Órdenes de Trabajo con foto muestran un fondo plano y más nítido, revelado progresivamente de izquierda a derecha sin perder legibilidad en datos, estados y SLA.",
    "Corrección: En el Portal (/request) en celular, tomar o elegir foto ya no reinicia el formulario: se comprime la imagen en el dispositivo y se guarda un borrador local por si el navegador se recarga al abrir la cámara.",
    "Nuevo: En el Portal de Solicitudes (/request) puedes adjuntar una foto opcional desde la cámara o la galería; se guarda como evidencia de la falla en la OT.",
    "Corrección: El Calendario y las notificaciones ya no llaman a localhost; usan el host del servidor (necesario en Ubuntu / acceso por IP).",
    "Nuevo: Dashboard de técnicos en KPIs: carga del día, OTs pausadas, tiempo en espera y productividad semanal (cierres y horas de labor), con gráfica top 8.",
    "Mejora: Al pausar una OT (En espera) se registra la hora de pausa para medir el tiempo detenido con precisión.",
    "Nuevo: Actualización casi en tiempo real en todo el sitio (órdenes, inventario, activos, compras, checklist, roster, RCA, zonas, usuarios, etc.) vía Socket.IO, sin necesidad de refrescar la página.",
    "Nuevo: Bloqueo suave de Órdenes de Trabajo: si alguien tiene una OT abierta, los demás la ven en solo lectura con el aviso «En edición por…». Al cerrar o perder conexión, el candado se libera.",
    "Mejora: Al aceptar/cambiar estado de una OT, si otro usuario ya la movió, el sistema responde con conflicto (409) y evita pisar el cambio.",
    "Nuevo: En el Catálogo de Checklist puedes definir el número de columnas (máquinas L1…Ln, hasta 12). Los checklists nuevos usan ese conteo; los históricos conservan el suyo.",
    "Nuevo: En Configuración → Catálogo de Checklist, cada tarea tiene un selector Check / Número / Texto para definir el tipo de respuesta en los próximos checklists diarios.",
    "Nuevo: Desde la tarjeta de Stock Crítico en Inventario puedes generar, en un clic, borradores de Orden de Compra con los ítems bajo mínimo (agrupados por proveedor).",
    "Mejora: Se eliminó el filtro duplicado «Stock Crítico» junto a la búsqueda y el botón «Generar Pedido» (lista .txt); el flujo queda en la tarjeta superior y en Órdenes de Compra.",
    "Nuevo: Impresión QR masiva disponible tanto en Repuestos como en Ubicaciones, con selección por filtros y hoja de etiquetas.",
    "Mejora: El detalle de las órdenes usa una ventana más amplia y compacta, distribuye mejor la información, permite textos completos y muestra evidencias sin recortarlas.",
    "Mejora: El Árbol de Fallas (RCA) al finalizar una correctiva queda opcional, para no forzar datos incorrectos cuando el caso aún no está en el catálogo.",
    "Nuevo: Los folios de órdenes se estandarizan como FOL-#### (inmutables, autogenerados). La importación CSV ya usa la columna FOLIO con ese formato.",
    "Mejora: La búsqueda global muestra el atajo Ctrl/Cmd+K (Windows y Mac).",
    "Mejora: En el vistazo del activo, las etiquetas RCA, PMs y stock crítico muestran ayuda al pasar el puntero.",
    "Nuevo: Al finalizar una OT, los repuestos registrados se descontan del almacén de forma atómica, quedan ligados a esa orden y el costo de refacciones se muestra en el detalle.",
    "Nuevo: Historial del activo «de un vistazo»: al abrir o escanear un equipo ves últimas OTs, fallas RCA, PMs próximos, stock crítico relacionado y costo acumulado.",
    "Nuevo: Búsqueda global con Ctrl/Cmd+K para activos, repuestos, ubicaciones y folios de OT.",
    "Nuevo: Impresión masiva de etiquetas QR desde Activos y desde Ubicaciones de inventario.",
    "Mejora: Configuración estrena la pestaña «SLA y tiempos» con formulario por prioridad (Urgente/Normal/Bajo) para editar horas de recordatorio y escalamiento sin tocar código.",
    "Corrección: SLA ya no satura Telegram con el rezago histórico: al arrancar marca en silencio las OT vencidas, y si hay muchos avisos nuevos envía un solo resumen.",
    "Nuevo: SLA y escalamiento por prioridad (respuesta, OT detenida y resolución) con recordatorios automáticos cada 15 min, Telegram al grupo e in-app a gestores/admins.",
    "Nuevo: Configuración de umbrales SLA editables en Configuración → Notificaciones, con badges Dentro de SLA / En riesgo / Vencido en órdenes.",
    "Corrección: La importación CSV de órdenes ya crea activos faltantes con código ACT-XXXX (ya no genera EQ- aleatorios).",
    "Mejora: El degradado del Manual ahora aparece progresivamente según el desplazamiento y el contenido llega hasta el borde inferior disponible.",
    "Mejora: El contenido del Manual se desvanece bajo un degradado al desplazarse detrás del encabezado y temario fijos.",
    "Mejora: En el Manual, el encabezado y el temario permanecen fijos; únicamente se desplaza la información del tema seleccionado.",
    "Mejora: El botón Volver del Manual queda integrado al temario fijo y permanece accesible al desplazarse.",
    "Mejora: En órdenes finalizadas y anuladas, el estado se presenta como una etiqueta informativa en lugar de un desplegable bloqueado.",
    "Mejora: En órdenes finalizadas ya no se puede Eliminar ni Anular (también bloqueado en el servidor).",
    "Mejora: En detalle de una orden finalizada, los técnicos aparecen como lista de quienes intervinieron (sin checkboxes).",
    "Mejora: El estado se muestra con nombres claros (Pendiente, En Proceso, En Espera) y el desplegable ofrece acciones: Aceptar orden, Pausar, Finalizar, Reanudar.",
    "Mejora: “Total recibidas” en Inicio ahora es una tarjeta únicamente informativa y su cifra tiene una jerarquía visual ligeramente mayor.",
    "Mejora: En celular, el temario del Manual se presenta como una barra deslizable y cada tema entra con una transición de derecha a izquierda.",
    "Mejora: La introducción del Manual de Usuario ahora explica objetivos, flujo operativo, trazabilidad y responsabilidades por rol.",
    "Mejora: El Árbol de Fallas en celular usa un flujo guiado Problema → Causa → Solución, con ruta visible, navegación por pasos y regreso rápido.",
    "Terminología: La etiqueta visible “Remedios” cambia a “Soluciones” en RCA, permisos y detalle de órdenes.",
    "Mejora: En celular, la versión (novedades y manual) aparece en la barra superior; también se reforzó el botón en el menú lateral.",
    "Mejora: El manual de Telegram explica paso a paso cómo obtener Bot Token y Chat ID (configuración nueva) y cómo recuperarlas si se olvidaron.",
    "Mejora: Estandarización visual de toda la app (sistema industrial ejecutivo): emerald como acción primaria, headers/cards/modales/tablas coherentes.",
    "Mejora: Modo día y noche completados en páginas, tablas, modales, login, portal y gráficas; tokens CSS compartidos.",
    "Corrección: La etiqueta horizontal de MTTR/MTBF ya no se encima con la leyenda ni con la gráfica.",
    "Mejora: La ventana de retrabajo en KPIs ya no es fija a 7 días: puedes elegir 3, 7, 14, 30 o un valor personalizado.",
    "Mejora: La gráfica MTTR/MTBF ahora explica el eje horizontal (meses), el vertical (horas) y qué mide cada línea.",
    "Mejora: El acceso con contraseña a Opciones de Desarrollador queda centrado dentro del panel de configuración.",
    "Mejora: Opciones de Desarrollador estrena una distribución más clara y responsive, separando importación y respaldos, Telegram, mantenimiento y zona de peligro.",
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
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
          
          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Última Actualización</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{updateDate}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className="text-amber-500 text-lg">✨</span> Novedades (v{version})
            </h3>
            <ul className="space-y-2">
              {changelog.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  {change}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Server size={16} className="text-slate-400" />
              Módulos Instalados
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {modules.map((mod, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  {mod}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-3">
          <Link 
            to="/manual" 
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
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
