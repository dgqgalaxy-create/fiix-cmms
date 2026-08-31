import { X, Info, Rocket, Server, Shield, CheckCircle2, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const APP_VERSION = "1.56.82";

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionModal = ({ isOpen, onClose }: VersionModalProps) => {
  if (!isOpen) return null;

  const version = APP_VERSION;
  const updateDate = "31 de Agosto, 2026";
  const modules = [
    "Inicio (Resumen Operativo)",
    "Órdenes de Trabajo",
    "Mensajes (chat interno)",
    "Gestión de Activos (Equipos)",
    "Catálogo de Inventario",
    "Planes Preventivos",
    "Módulo de Compras",
    "Activos (zonas y secciones)",
    "Permisos",
    "Directorio y Solicitantes",
    "KPIs y Metas",
    "Checklist Diario",
    "Notas y pendientes",
    "Calendario de Horarios y Turnos (Roster)",
    "Opciones de Desarrollador"
  ];
  const changelog = [
    "Mejora: Líneas y Costos — el buscador ahora busca solo dentro del nivel seleccionado (Línea o Sección), no en toda la tabla general.",
    "Mejora: Orden de activos — en Líneas y Costos van primero los críticos y luego alfabético por nombre; en la tabla de Activos el orden por defecto es alfabético por nombre.",
    "Mejora: Inicio — la tarjeta «Stock crítico» ahora se llama «Stock bajo» y cambia a naranja (igual que en Inventario).",
    "Nuevo: Líneas y Costos — buscador de activos (por nombre, código, marca o modelo) para saltar directo a un equipo y ver sus refacciones.",
    "Mejora: Líneas y Costos — los activos críticos ahora muestran el badge rojo «Crítico» (como en la tabla de Activos).",
    "Mejora: Inventario — la franja «Stock crítico» ahora se llama «Stock bajo» y cambia a color naranja.",
    "Mejora: Inventario — el buscador de repuestos ahora también busca por categoría y ubicación (no solo código o nombre).",
    "Nuevo: Líneas y Costos — botón «Refacciones críticas» que exporta la lista de refacciones (con stock) de los equipos críticos.",
    "Nuevo: Inventario — filtro «Refacciones de equipos críticos» para ver solo repuestos asignados a equipos críticos.",
    "Mejora: Activos — clic en una refacción del árbol (Zona → Sección → Activo → Refacciones) ahora permite editar con permiso Administrar Inventario.",
    "Nuevo: Inventario — opción de eliminar repuestos, protegida por el permiso «Eliminar Repuestos» (Opciones de Desarrollador → Permisos).",
    "Mejora: Detalle del activo — clic en una refacción abre el detalle del repuesto; con permiso Administrar Inventario se puede editar.",
    "Mejora: Líneas y Costos — clic en una refacción abre el detalle del repuesto (solo lectura).",
    "Mejora: Detalle del activo — se abre por defecto en la pestaña «Información» (antes «De un vistazo»).",
    "Mejora: Líneas y Costos — ahora puedes editar el activo desde el detalle (botón Editar, mismo formulario).",
    "Nuevo: Importación CSV/Sheets/Drive — opción «Dejar activos intactos» para no crear ni actualizar activos (marcada por defecto).",
    "Corrección: Líneas y Costos — migas de pan sin duplicar el nivel (Líneas > Línea > Sección > Activo).",
    "Nuevo: Inventario — valor total del inventario (stock × costo) y filtro de periodo en movimientos.",
    "Nuevo: Inventario — flujo de costos por periodo (total entrado vs total salido) según filtros de tipo y fechas.",
    "Mejora: Líneas y Costos — actualización en vivo vía socket (activos, órdenes e inventario).",
    "Nuevo: Activos — asignación de refacciones por activo (desde inventario, con cantidad) y desglose Zona → Sección → Activo → Refacciones en Líneas y Costos.",
    "Nuevo: Líneas y Costos — muestra valor de activos y costo de reparación por separado en cada nivel.",
    "Mejora: Líneas y Costos — imagen de secciones visible en todo el desglose; exportar Excel exporta todo el árbol de líneas visibles.",
    "Mejora: Activos — los botones QR masivo y Nuevo Activo solo se muestran en la vista Tabla.",
    "Mejora: importación CSV/Sheets — evita duplicar usuarios (empareja por nombre además de por email).",
    "Mejora: respaldo automático — ahora también respalda la carpeta data/ y backend/.env (todo el sitio).",
    "Nuevo: script de borrado de base de datos (backend/scripts/wipe_database.js).",
    "Nuevo: Líneas y Costos — imagen con la distribución de secciones por línea, arriba de las tarjetas de líneas.",
    "Nuevo: Líneas y Costos — gráfica de barras de gasto por línea (según las líneas visibles y el periodo seleccionado).",
    "Mejora: Líneas y Costos — la configuración de líneas visibles ahora es global (aplica a todos) y solo el Administrador puede cambiarla.",
    "Nuevo: Activos — campo «Crítico» (badge + filtro críticos/no críticos) y campo «Obsoleto» (oculto por defecto, con botón Mostrar/Ocultar obsoletos).",
    "Nuevo: Líneas y Costos — botón «Configurar líneas» para elegir qué líneas mostrar (se guarda por usuario) y toggle de obsoletos.",
    "Nuevo: Activos — vista «Líneas y Costos» con explorador por Línea → Sección → Equipo y gasto de repuestos por periodo (selector Este mes / 3 meses / Este año / Personalizado, y exportar a Excel).",
    "Mejora: Horarios — aviso del orden de importación recomendado (primero base de datos CSV, al final el calendario).",
    "Nuevo: Horarios — filtro de personal (desplegable) para Administrador y Gestionador; el Técnico ve solo su propio horario.",
    "Mejora: Horarios — al reimportar el calendario se borra todo el rango anterior y se carga el nuevo (reemplazo total, incluso si se quitó a alguien).",
    "Nuevo: Horarios — botón «Importar Calendario» para cargar el calendario anual de turnos desde Excel (.xlsx), día por día por técnico.",
    "Nuevo: Horarios — turnos importados (Día, Noche, Mixto, T. Extra, Vacaciones, Falta, Permiso S/G, Tiempo por Tiempo, etc.) se muestran con su propio color en el calendario.",
    "Seguridad: Importar Calendario y Asignar Patrón quedan disponibles solo para Administradores (no Técnicos ni Gestionadores).",
    "Nuevo: Compras — IVA % en la orden (0 / 8 / 16 u otro); precios de línea sin IVA; subtotal + IVA + total en detalle, creación, listado y PDF.",
    "Nuevo: Compras — puedes adjuntar Cotización (PDF/Word) además de SP (SAP), OC (SAP) y Otro.",
    "Mejora: Nueva Orden de Compra — ventana más alta; catálogo del proveedor en panel amplio; listas desplegables se adaptan a la pantalla sin quedar recortadas.",
    "Mejora: Todos los desplegables de elección en la app permiten escribir para filtrar (órdenes, activos, portal, inventario, compras, roster, KPIs, notas, mensajes, checklist, etc.).",
    "Mejora: En la ficha de repuesto, el Nombre ocupa el ancho completo (como Descripción); el código interno queda en una fila compacta arriba.",
    "Mejora: En la ficha de repuesto (crear/editar), Categoría, Ubicación, Proveedor, Unidad y demás listas permiten escribir para filtrar opciones (ya no solo despliegue largo).",
    "Mejora: Compras — la fila o tarjeta de cada orden abre el detalle al tocarla (la flecha queda como indicador).",
    "Nuevo: Compras — búsqueda por folio, proveedor, ítem y SP/OC (SAP); campos SP (SAP) / OC (SAP), fecha estimada editable y adjuntos PDF/Word en el detalle.",
    "Mejora: Logo de marca actualizado (login, menú lateral y modal de versión).",
    "Mejora: Marca visible unificada a GTZ CMMS (ya no «CMMS MTTO»).",
    "Nuevo: Import CSV/Sheets — el resultado queda en Bitácora de auditoría (IMPORT_SHEETS / IMPORT_CSV) para consultarlo después.",
    "Nuevo: Import — logos de proveedores (Vendors_Images.zip, Drive GOOGLE_DRIVE_VENDORS_FOLDER, o data/Vendors_Images/).",
    "Mejora: Inventario — clic en repuesto abre solo lectura; Editar junto a Registrar movimiento (Admin/Gestionador).",
    "Mejora: Proveedores — logo más bajo para que quepan bien los datos en la tarjeta.",
    "Nuevo: Inventario → Proveedores — logo en ficha y tarjetas; archivos en uploads/vendors/ (incluidos en respaldos).",
    "Corrección: Ctrl+K — al elegir un repuesto abre su ficha (antes fallaba con el UUID).",
    "Mejora: Inventario — el estado desmarcado se muestra como «Descontinuado» (ya no «Inactivo»).",
    "Corrección: Tras «Importación terminada» el modal Procesando se cierra solo (y hay botón Cerrar); la limpieza de /tmp ya no bloquea la respuesta.",
    "Corrección: Fotos Drive — descarga por enlace público (uc/usercontent); alt=media+API key devolvía 403 HTML aunque el listado funcionara.",
    "Corrección: Descarga Drive — sonda del primer archivo, redirects absolutos, supportsAllDrives en media y corte rápido si falla (ya no se queda en 0/2386 con CPU ocupada).",
    "Corrección: Descarga Drive — el redirect de Google ya no deja la importación colgada en «Listando…» sin escribir archivos; el modal pasa a «Descargando X/Y».",
    "Nuevo: Al importar Sheets/Drive, el modal Procesando muestra barra de avance y conteo de fotos (listado/descarga). Timeouts en Drive para no colgarse.",
    "Corrección: Tras entrar a Opciones de Desarrollador se muestra Key OK de Drive; CORS ya no bloquea Tailscale/HTTPS al definir CORS_ORIGINS.",
    "Mejora: PDF de Órdenes — Falla/Equipo sin recorte; Orden, fechas y estado más compactos.",
    "Mejora: PDF del listado de Órdenes muestra fechas de Solicitud, Inicio y Fin (Falla/Equipo más compacta).",
    "Corrección: En Mis Órdenes ya no aparece el botón Asignar… (solo en Vista General).",
    "Mejora: Órdenes — Mis Órdenes sin filtros; pestaña Cerradas (antes Historial) solo Finalizado/Anulado; Vista General solo Pendiente/En proceso/En espera. Asignar personal funciona offline con caché de usuarios.",
    "Corrección: /uploads con sesión y archivo inexistente responde 404 (no 500); smoke-hardening aclara errores de login.",
    "Nuevo: Rutina de pruebas del endurecimiento — scripts/smoke-hardening.sh + Fase H en plan_pruebas.md (uploads, Helmet, paginación, KPI).",
    "Corrección: Build PWA — NetworkOnly en /api ya no usa networkTimeoutSeconds (Workbox lo rechazaba y tumba el deploy).",
    "Mejora: Deploy más rápido — npm ci solo si cambió el lockfile; typecheck ya no reinstala el frontend (el gate UI sigue siendo el build).",
    "Corrección: Deploy ya no ejecuta nvm bajo set -e (provocaba exit 3 silencioso); usa tarball Node 22 en ~/.local.",
    "Corrección: Deploy — si nvm falla al instalarse, se usa el tarball oficial de Node 22 (el install.sh de nvm a veces sale con código 3).",
    "Corrección: El deploy self-hosted instala/activa Node 22 si el runner aún tiene Node 20 del sistema (nvm + PATH).",
    "Corrección: Typecheck del deploy fuerza Node 22 y prisma generate tras npm ci (evita fallos masivos de tipos Prisma en el runner).",
    "Corrección: El typecheck del deploy vuelve a ejecutar npm ci (antes reutilizaba node_modules viejo y fallaba al añadir deps como helmet).",
    "Mejora: Endurecimiento — usuarios inactivos rechazados en API; Helmet/CORS; /uploads con token; límites Multer/JSON; índices BD; paginación servidor Activos/Repuestos; KPI top fallas por groupBy; debounce sockets; AbortController en listados; PWA sin cachear /api; cola offline no descarta 401 a ciegas.",
    "Mejora: Vista General y Mis Órdenes también paginan en servidor (20/página); PDF Carta más denso (márgenes y tipografía) con falla limitada a 2 líneas por fila.",
    "Mejora: Paginación en servidor (OT historial, movimientos, OC); Inicio/Calendario cargan rangos acotados; badge Mis OT por conteo; filtro Solicitante; export con Solicitante/Tipo/Paro; historial de repuesto y «cargar mensajes anteriores».",
    "Mejora: Todos los PDF/impresión usan hoja Carta (Letter 21.6×27.9 cm): Órdenes y calendario en horizontal; checklist, OC y QR en vertical.",
    "Mejora: Excel/CSV/PDF de Órdenes exportan la columna Falla (descripción completa de la solicitud) en lugar del título corto.",
    "Corrección: En Órdenes, el botón PDF ya no genera hoja en blanco; imprime la misma lista filtrada que Excel/CSV (p. ej. por solicitante).",
    "Mejora: Órdenes → Historial e Inventario → Movimientos muestran 20 registros por página (como Repuestos), para no ralentizar la pantalla con listas muy largas.",
    "Nuevo: KPI — periodo personalizado (Desde/Hasta); marco visual de filtros; gráficas de OT finalizadas y tiempo promedio de labor por técnico (sin pausas).",
    "Nuevo: Órdenes — filtro periodo inicio/fin y filtro Estado; Inventario Movimientos — entradas/bajas/todos; marcos de filtro en OT, Activos e Inventario.",
    "Corrección: Si el servidor cae y das F5, ya no queda el círculo girando minutos — timeout de API ~15 s, PWA corta red en ~5–8 s y muestra «No se pudo conectar» con Reintentar.",
    "Nuevo: Seguridad — rate limit en login y portal público; JWT_SECRET obligatorio (sin default inseguro); límite 12 MB e imágenes en subidas de OT/portal.",
    "Nuevo: Deploy — typecheck de backend antes de update (Actions); timeout 45 min; aviso de versión GitHub con GITHUB_TOKEN en repos privados.",
    "Mejora: Al abrir un chat con mensajes sin leer, la vista salta al primer no leído (el más antiguo) y muestra el separador «Mensajes nuevos».",
    "Nuevo: Watchdog del GitHub Actions runner en el servidor — reinicia la sesión si se cuelga (Waiting for a runner) y activa NTP; install.sh pregunta por instalarlo.",
    "Mejora: En interfaz móvil, el menú lateral ya no repite Inicio, Órdenes, Mensajes ni Inventario (van en la barra inferior); sin barra inferior sí aparecen en el menú.",
    "Nuevo: En interfaz móvil, la barra inferior incluye Mensajes (orden: Mis OT, Mensajes, Escanear, Inventario, Inicio).",
    "Mejora: Badges en la barra inferior — Mis OT muestra OT abiertas asignadas a ti; Mensajes muestra no leídos.",
    "Corrección: En Windows ya no salen 2 toasts push a la vez (Chrome + PWA / suscripciones duplicadas del mismo PC); se deja una por tipo de dispositivo.",
    "Mejora: Push en Android — patrón de vibración más fuerte; si la PWA está en segundo plano también vibra por la app. Si solo suena y no vibra con la app cerrada, activa Vibrar en Ajustes → Apps → Notificaciones.",
    "Corrección: En interfaz móvil, el menú lateral ya no queda tapado por la barra inferior (Mis OT / Escanear / …); se puede ver y usar hasta el final (usuarios en línea, tema, salir).",
    "Corrección: «Usuarios en línea» cuenta también quien tiene el socket conectado (no solo el heartbeat) y se actualiza cada 15 s.",
    "Corrección: Entrega de mensajes en vivo fuera de Mensajes — el ACK de «entregado» ya no falla; palomitas pasan a ✓✓ aunque el otro esté en otro módulo.",
    "Corrección: El despliegue ya no falla al compilar el socket de chat (import ESM); el botón «Recargar ahora» reintenta limpiar caché aunque un intento previo no avanzó.",
    "Nuevo: En Mensajes, tus mensajes muestran palomitas tipo WhatsApp (enviando / enviado / entregado / leído); al pasar el cursor o mantener verás la palabra.",
    "Mejora: El chat se reconecta al volver a la app en móvil (menos necesidad de «actualizar» para ver mensajes nuevos).",
    "Mejora: Mensajes — tono de notificación al llegar un mensaje (además de vibración); el push del sistema usa el sonido del teléfono.",
    "Corrección: El banner de mensaje nuevo ya no aparece duplicado (dedupe del mismo mensaje; si la app está abierta no se muestra también el push del sistema).",
    "Mejora: Mensajes en PWA móvil — vibración al llegar aviso; push del sistema con patrón de vibración; si la app está en segundo plano también intenta notificación local.",
    "Nuevo: Al recibir un mensaje aparece un banner arriba a la derecha (entra con zoom y a los 5 s se oculta hacia la derecha); tocarlo abre el chat.",
    "Mejora: En Mensajes, un chat vacío muestra «Sin mensajes» (sin invitar a escribir en el área del hilo; el cuadro de abajo sigue para redactar).",
    "Mejora: En Órdenes de Trabajo, cada tarjeta/fila muestra cuántos comentarios tiene y un adelanto del más reciente.",
    "Nuevo: Rol Observador — solo consulta operativa + Mensajes (sin crear/editar/eliminar). Ideal para gerentes de otras áreas o auditores.",
    "Nuevo: En Mensajes puedes eliminar tus propios mensajes durante los primeros 10 minutos (quedan como «Mensaje eliminado»; el Admin no lee chats ajenos ni ve el contenido oculto en la app).",
    "Corrección: En interfaz móvil, el cuadro para escribir mensajes queda encima de la barra inferior (Mis OT / Escanear / …), no oculto detrás.",
    "Nuevo: Comentarios en el detalle de OT — quien pueda abrir la orden puede leer y escribir (texto + adjunto); actualización en vivo.",
    "Nuevo: Mensajes internos — chat 1:1 y grupos ad-hoc con adjuntos; badge de no leídos en el menú; notificaciones in-app y push.",
    "Mejora: Avisos globales — el formulario de publicación queda oculto detrás del botón «Nuevo aviso global».",
    "Corrección: El check «Completados» en Notas y pendientes solo se muestra en Mis notas y Pendientes (no en Avisos).",
    "Mejora: En Unidades de Medida el Admin puede editar Enteros/Decimales de cada unidad (no solo al crear).",
    "Mejora: Menú lateral más compacto (menos espacio vertical) para ver más opciones a la vez.",
    "Corrección: El backend local ya no falla al registrar movimientos de inventario (variable de cantidad).",
    "Nuevo: Unidades de medida en Configuración (Admin) con modo Enteros/Decimales sugerido; en cada artículo eliges si las cantidades son enteras o decimales (movimientos, OT y OC respetan la regla).",
    "Mejora: En móvil, «Aceptar y continuar» guarda solo si ya hay foto Antes (sin diálogo extra); si falta la foto, al subirla se guarda automáticamente.",
    "Mejora: Stock crítico — tarjeta en Inicio; borradores OC no duplican ítems ya en OC abiertas; botón «Crear borrador OC desde críticos».",
    "Corrección: Al tocar «Aceptar orden» el botón azul ya no se queda igual: pasa a confirmación de guardado (y lo mismo para Pausar / Finalizar / Reanudar).",
    "Corrección: Avisos con foto — al tocar la imagen se amplía dentro de la app (ya no abre/cierra una pestaña en la PWA). Marcar como visto ya no recarga a todos los usuarios.",
    "Nuevo: Avisos globales en Notas y pendientes — visibles para todos; solo Admin publica (con foto opcional). Al abrirlos se marcan como vistos; el Admin ve quién ya los leyó (contador y lista).",
    "Corrección: Costos históricos congelados — al cerrar una OT (y en movimientos de inventario/recepción OC) se guarda el unit_cost del momento; OT/KPI/activo ya no releen el precio actual del catálogo. Migración one-shot rellena consumos OT viejos null/0 desde el catálogo una sola vez.",
    "Aclare: En OC aprobada/enviada/recibida/cancelada el costo unitario queda congelado (no se actualiza al cambiar el precio en inventario); solo en borrador se puede sincronizar.",
    "Cambio: Órdenes de compra — solo un Administrador puede aprobar. El Gestionador crea en borrador (sin autoaprobar); el Admin crea ya aprobada.",
    "Cambio: Pendientes operativos — solo Admin y Gestionador pueden crear/editar/eliminar; los técnicos asignados solo los ven y pueden completarlos.",
    "Mejora: En pendientes asignados, solo el creador puede editar/posponer/reabrir; el asignado ve el pendiente (etiqueta «Solo lectura») y puede completarlo.",
    "Mejora: En Notas y pendientes, un aviso bajo las pestañas aclara que las notas son solo tuyas y los pendientes los ven quien los crea y el asignado.",
    "Mejora: Órdenes de compra — el costo unitario se precarga del inventario; solo Administrador puede cambiarlo (y al hacerlo actualiza el catálogo). Desde la OC puedes abrir el detalle del artículo, editarlo y, en borradores, sincronizar precios con «Actualizar precios del inventario».",
    "Mejora: Notas y pendientes — editar, filtros (míos/asignados/creados), vencidos/próximos, prioridad Alta, comentario al completar, reabrir, posponer +1 h / mañana, tarjeta en Inicio, badge en el menú y acceso rápido desde el detalle de OT.",
    "Nuevo: Notas personales (privadas) y pendientes operativos asignables — menú «Notas y pendientes»; vínculo opcional a OT (folio) o activo; recordatorio con fecha (in-app + push). Cualquier usuario puede crear/asignar pendientes.",
    "Mejora: En Herramientas locales, «Limpiar caché PWA» ahora explica cuándo usarlo (versión vieja tras update, pantallas rotas o UI desactualizada).",
    "Nuevo: Bitácora de auditoría — el histórico se conserva sin límite en BD; puedes descargar Excel por periodo (fechas México) o el histórico completo (Opciones de Desarrollador, solo Admin).",
    "Mejora: En Opciones de Desarrollador, la tarjeta «Respaldo del servidor» ya no se estira con espacio vacío a la derecha: se reacomodó junto a «Importar desde Google Sheets» y sus botones Crear/Restaurar van en una sola fila.",
    "Nuevo: Checklist Diario — al pasar el día (hora México) los no enviados pasan a Incumplimiento y quedan bloqueados. El técnico asignado puede solicitar continuar; solo un Administrador aprueba. Si no hay técnico, el Admin puede asignarlo (sigue en Incumplimiento).",
    "Corrección: Al registrar refacciones en una OT (y en movimientos/planes), la cantidad solo admite valores positivos; el API rechaza negativos o cero.",
    "Cambio: En el Manual (Opciones de Desarrollador), el encabezado del borrado destructivo pasa a «Zona de peligro» (se quitó la etiqueta inapropiada).",
    "Nuevo: Checklist Diario — el técnico asignado puede «Traspasar» a otro; el destinatario Acepta o Rechaza (también se puede cancelar el traspaso pendiente).",
    "Mejora: En Inicio, «Líneas paradas» (L1–L5) incluye OT preventivas abiertas con paro de máquina, además de las correctivas; la racha sigue contando solo correctivo.",
    "Corrección: En el detalle del repuesto, «Registrar movimiento» (naranja) ya no es solo Admin: Técnico y Gestionador lo ven; el modal limita Entrada (IN) a quien tenga permiso de entradas.",
    "Mejora: Checklist Diario — Imprimir/PDF solo si está enviado/firmado o revisado; el PDF cabe en una hoja A4 vertical.",
    "Mejora: En Inicio, la tarjeta «Total recibidas» aclara con una leyenda breve que no incluye órdenes invalidadas.",
    "Nuevo: En tarjetas de OT, Admin/Gestionador puede tocar «Sin asignar» para abrir el detalle en asignación, o el icono de calendario para ir a Calendario listo para agendar esa orden.",
    "Mejora: Al crear, editar o asignar en masa una OT, la lista de personal incluye Gestionadores activos (además de Técnicos).",
    "Corrección: Al finalizar una OT no se sobrescribe completed_at si ya venía del CSV; las fechas/horas en pantalla usan America/Mexico_City.",
    "Corrección: El costo de refacciones de una OT ya no queda en $0 cuando el catálogo tenía purchase_cost vacío o unit_cost forzado a 0 (fallback al catálogo + migración 0→null).",
    "Mejora: Buscar por zona (ej. L1) muestra órdenes en Ctrl+K y en la barra de Órdenes de Trabajo; también puedes abrir el listado filtrado desde el resultado «Órdenes en zona…».",
    "Corrección: Las fechas de los CSV se interpretan siempre en hora de planta (America/Mexico_City), no en la zona horaria del servidor. Antes el mismo archivo importado en el servidor Ubuntu (UTC) guardaba las OT 6 horas antes que en local y eso movía un día la racha sin paros, el récord y los KPIs.",
    "Cambio: Crear o abrir el Checklist Diario ya no asigna técnico. Solo lectura hasta pulsar «Iniciar checklist»; entonces se reclama y se puede editar/enviar. Si otro ya lo inició, queda en solo lectura.",
    "Mejora: La importación manual se separa en dos operaciones seguras: Inventario (6 CSV + Items_Images.zip) y Órdenes (1 CSV + Formulario Solicitudes_Images.zip). Ambas usan upsert y pueden ejecutarse por separado.",
    "Nuevo: Fotos desde carpetas públicas de Google Drive en import CSV/Sheets (Opciones de Desarrollador) — casilla + GOOGLE_DRIVE_* en .env; prioridad zip > Drive > data/.",
    "Corrección: Con «Alertas por Telegram» desactivadas en Configuración ya no se envían mensajes (SLA, checklist, nuevas OT, ni el cron healthcheck.sh); el .env solo se usa como credencial si el interruptor está activo (o BD inaccesible en healthcheck).",
    "Cambio: El login ya no muestra siempre admin@fiix.com / password123; esas credenciales solo aparecen en el aviso tras vaciar la base de datos.",
    "Cambio: Import Google Sheets en modo temporal sin credenciales — export CSV público (ambos Sheets en «Cualquier persona con el enlace → Lector»).",
    "Nuevo: Importar ahora desde Google Sheets (Opciones de Desarrollador) — lee las 7 pestañas mapeadas y reutiliza el motor de import CSV.",
    "Mejora: El sonido de alerta de OT críticas (Inicio / sala de control) vuelve a subir otro 50% de volumen (tercera subida).",
    "Mejora: El sonido de alerta de OT críticas (Inicio / sala de control) vuelve a subir otro 50% de volumen.",
    "Mejora: El sonido de alerta de OT críticas (Inicio / sala de control) suena un 50% más alto.",
    "Cambio: Marca visible del producto pasa a GTZ CMMS (PWA, títulos, Telegram/email, scripts). Las etiquetas QR nuevas usan GTZ-ASSET/ITEM/LOCATION; las FIIX-* impresas siguen leyéndose.",
    "Nuevo: Al escanear un QR suena un bip corto de confirmación.",
    "Corrección: Import CSV + zip — timeouts nginx/axios a 120m (2 h) por si acaso tras 408 en Tailscale; client_max_body_size sigue en 1100M.",
    "Corrección: Import CSV + zip por Tailscale — nginx client_body_timeout a 60m; si no hay zip en el navegador, se usan data/Items_Images/ y data/Formulario Solicitudes_Images/ (SCP/rsync); tip :3000 en Opciones de Desarrollador.",
    "Corrección: «Recargar ahora» / actualización PWA ya no se queda en versión vieja: desregistra el service worker, limpia caché y fuerza carga del build nuevo; index.html/sw.js sin cache largo en el servidor.",
    "Cambio: Se eliminó la tarjeta «Solo fotos de órdenes» de Opciones de Desarrollador (redundante: el zip de OT va con la importación maestra de 7 CSV). Se mantiene el selector de zip en Importar CSV.",
    "Mejora: Listado de Activos sin scroll horizontal (columnas que se ocultan/recortan según ancho) y paginación de 20 por página, igual que Inventario.",
    "Mejora: En Inicio → Racha sin paro muestra el récord histórico (mejor racha) y mensajes de ánimo/celebración al igualarlo o superarlo.",
    "Mejora: Listado de Activos más denso (filas/tarjetas compactas como Checklist y Compras); código interno completo en una línea; se quita el chip C/F redundante.",
    "Corrección: Import CSV + zip — timeout 408 de nginx (client_body_timeout) al subir por Tailscale; conf con timeouts 30m/60m, mensaje claro y axios a 60 min.",
    "Corrección: Import CSV + zip — nginx documentado a client_max_body_size 1100M (2 zips × 500 MB); el service worker ya no intercepta POST de /api (evita Network Error); mensajes de error con comandos Ubuntu exactos.",
    "Corrección: En el login, usuario o contraseña incorrectos muestran el mensaje «Contraseña o usuario incorrectos» sin recargar la página ni comportarse como un cierre de sesión. No hay bloqueo por intentos fallidos (a diferencia del menú de desarrollador).",
    "Corrección: Contraseña incorrecta en Opciones de Desarrollador ya no cierra la sesión ni manda al login; muestra el error, permite 3 intentos y bloquea 1 hora tras fallar (bloqueo guardado en la cuenta).",
    "Corrección: Al crear un repuesto, el stock inicial ya no se escribe a ciegas: si es mayor a 0 se registra como movimiento de entrada «Levantamiento de inventario (stock inicial)». En edición el stock sigue solo lectura (cambia con movimientos).",
    "Nuevo: Import CSV — fotos del zip Items_Images de ítems ACTIVOS también se copian a Activos (uploads/assets/). En el detalle del activo (Información) hay botón Editar. Códigos MTTO siguen generándose con las reglas normales (Item ID Fiix no sobrescribe el código del activo).",
    "Nuevo: La importación CSV maestra crea/actualiza Activos desde ítems de inventario con categoría ACTIVOS (ubicación LINEA N ACTIVOS → zona L1–L5; TAPANCO → TAPANCO; sin inventar sección). Los ítems de inventario se conservan.",
    "Nuevo: Zonas se administran dentro de Activos («Administrar zonas»). Cada zona puede tener secciones/subzonas configurables o modo «Sin secciones»; el import CSV de Solicitudes sigue igual (Equipo/Zona por nombre, activos sin sección si el CSV no trae sección).",
    "Nuevo: En Inicio, indicadores de líneas paradas (L1–L5 por OT correctiva con paro de máquina) y racha de días sin paro correctivo de línea.",
    "Corrección: Si la PWA se quedaba en una versión vieja tras ./update.sh, ahora detecta que el servidor es más nuevo y recarga; vuelve autoUpdate del service worker.",
    "Mejora: En Inicio → Turno actual (móvil), la tabla es más densa y cabe sin deslizar a la derecha (SLA como R/V; mismo espíritu que KPIs).",
    "Nuevo: Aviso en la app cuando GitHub tiene una versión más nueva (pendiente de ./update.sh) y cuando ya hay un build desplegado listo para recargar.",
    "Corrección: En la lista de Inventario se restauran los botones de acciones como antes; el estilo naranja «Registrar movimiento» queda solo en el detalle del repuesto.",
    "Mejora: En el detalle del repuesto (también desde Ctrl+K), el botón pasa a llamarse «Registrar movimiento» y usa estilo naranja de acción (no etiqueta verde).",
    "Mejora: Costos y precios en pantalla usan formato México ($1,234.56) con símbolo, miles y centavos (compras, activos, OT, KPIs).",
    "Mejora: En KPIs → Dashboard de técnicos, la tabla de detalle es más densa (menos scroll horizontal) sin cambiar las 4 tarjetas ni la gráfica.",
    "Mejora: Planes Preventivos en celular usa encabezado compacto y lista en tarjetas densas (menos scroll; en PC se mantiene la tabla), igual que Checklist y Compras.",
    "Corrección: En órdenes Pendiente ya no aparece Unirme / Colaborar; solo Aceptar orden. Unirme / Colaborar queda para OT En proceso o En espera si aún no estás asignado.",
    "Mejora: install.sh y update.sh generan solos las claves VAPID (Web Push) si faltan en backend/.env; no regeneran las ya existentes.",
    "Nuevo: Notificaciones del dispositivo (Web Push / PWA) — opt-in en la campana o Configuración → Apariencia; avisos de nuevas OT y SLA aunque la pestaña esté en segundo plano (HTTPS; iOS: app en Inicio).",
    "Mejora: En Configuración, el menú lateral usa la misma tipografía, tamaño de icono y estilo activo en todas las opciones.",
    "Nuevo: En Checklist diario, si marcas una cruz (falla) en una fila, la observación de esa fila es obligatoria para enviar; con palomita o N/A sigue siendo opcional (se guarda N/A).",
    "Mejora: Checklist diario y Compras en celular usan encabezado compacto y lista en tarjetas densas (menos scroll; en PC se mantiene la tabla).",
    "Cambio: Con permiso Ver Configuración, Técnico y Gestionador solo ven Apariencia; Administrador ve todas las secciones (Notificaciones, SLA, Desarrollador, etc.).",
    "Cambio: El interruptor Interfaz móvil del menú lateral también está disponible para Gestionador y Administrador (opt-in). En Técnico sigue activa por defecto.",
    "Cambio: «Interfaz móvil de técnico» deja de ser configuración global: cada técnico la activa/desactiva en su menú lateral (preferencia de su cuenta).",
    "Corrección: El diálogo del ⓘ (Más información) se muestra por encima de todo (portal) y se reubica si se sale de la pantalla (arriba/abajo y dentro del viewport).",
    "Corrección: Al finalizar una OT correctiva, el Árbol de Fallas (RCA) vuelve a mostrarse de forma clara (sigue siendo opcional para guardar) y la vista hace scroll a notas/RCA; en órdenes ya cerradas se ve el RCA registrado o «Sin RCA».",
    "Corrección: Si no estás asignado a una OT En proceso/En espera, solo ves Unirme / Colaborar (sin desplegable de estado ni Pausar/Finalizar). En móvil técnico, las acciones rápidas sustituyen al desplegable para no duplicar opciones.",
    "Corrección: Al finalizar una OT correctiva, el Árbol de Fallas (RCA) ya no bloquea Guardar si se deja vacío — sigue siendo opcional como indica la pantalla.",
    "Corrección: En OT ya En proceso o En espera, administradores y gestionadores (y quien no esté asignado) ya no ven Pausar/Finalizar/Reanudar; deben usar Unirme / Colaborar y luego sí operan.",
    "Nuevo: Inventario — ayudas ⓘ en Stock crítico / Excel / filtros; botones de escaneo y acciones de fila con área táctil más grande.",
    "Nuevo: Entradas de inventario (IN) también funcionan sin conexión (igual que las salidas OUT); se sincronizan al recuperar señal.",
    "Corrección: En Órdenes, Asignar… abre con las OT desmarcadas; el usuario elige cuáles asignar.",
    "Nuevo: En Órdenes, Asignar… permite asignar técnicos a varias OT abiertas de una sola vez.",
    "Nuevo: En Inicio, panel Turno actual con conteo por técnico (pendientes / en proceso / en espera y SLA).",
    "Nuevo: En KPIs, periodo Semana pasada y franja de comparación Esta semana vs semana pasada (órdenes, finalizadas, MTTR, SLA, backlog).",
    "Nuevo: Bitácora de auditoría (solo Admin) en Opciones de Desarrollador: últimos eventos de OT, inventario y permisos.",
    "Mejora: Interfaz móvil de técnico — textos de siguiente paso más claros, Guardar más visible y auto-guardar al aceptar/reanudar si ya hay foto Antes.",
    "Nuevo: Ayudas con icono ⓘ (información): en tablet/celular toca el ⓘ para leer la explicación (en PC también funciona al hacer clic). Incluido en Órdenes (pestañas y folio), Activos, KPIs, Calendario, SLA y Checklist.",
    "Corrección: En Calendario (tablet/celular), agendar pendientes se hace arrastrando el asa ≡ (el menú Descargar/Compartir del navegador ya no interfiere); la lista sigue deslizándose con normalidad.",
    "Corrección: En Calendario (tablet/celular), la lista de Pendientes vuelve a deslizarse con normalidad; para agendar hay que mantener pulsada la tarjeta ~0,4 s y luego arrastrarla al día.",
    "Corrección: En Calendario, arrastrar OT pendientes ya no tumba la app en PC (error maintenance_type) y en tablet/celular el soltar sobre el día asigna la fecha con más fiabilidad.",
    "Nuevo: Preferencia por usuario «Interfaz móvil de técnico» (menú lateral). Desactivada = el técnico ve la interfaz completa.",
    "Mejora: Nueva Orden de Compra — al elegir proveedor se listan de inmediato sus refacciones; también puedes buscar por nombre/código sin saber el proveedor (al elegir el ítem se toma su proveedor).",
    "Nuevo: Usuarios en línea muestra el módulo actual (ruta → etiqueta amigable: Órdenes, Inventario, Calendario, etc.).",
    "Mejora: En Inicio, las cifras de las tarjetas (resumen y Sala de control) latean suavemente al cambiar el valor.",
    "Corrección: En tablet/celular, arrastrar una OT pendiente al Calendario ya asigna la fecha al soltar (HTML5 DnD no funciona con touch).",
    "Nuevo: Al crear un respaldo, Opciones de Desarrollador muestra barra de progreso y el paso actual (preparar → BD → fotos → limpieza).",
    "Corrección: Respaldos con Postgres 17 (CasaOS/Docker) ya no fallan por pg_dump 16: se usa el cliente de mayor versión en /usr/lib/postgresql/N/bin y update.sh puede instalar postgresql-client-17 (repo PGDG).",
    "Mejora: install.sh / update.sh instalan o reparan postgresql-client (pg_dump/psql) para que Crear respaldo no falle solo con fotos y sin dump de BD.",
    "Mejora: Crear respaldo muestra la carpeta real del servidor, avisa que el tar de fotos puede tardar varios minutos y no se queda colgado sin error (timeout 15 min + logs PM2).",
    "Mejora: En Inventario, los botones Nuevo Repuesto, Excel y Registrar Movimiento tienen la misma altura y ancho; la alerta de Stock crítico pasa a una franja propia debajo del encabezado (celular y escritorio).",
    "Corrección: En la gráfica de dona del Inicio, la etiqueta emergente de Preventivo/Correctivo/Servicio ahora aparece siempre por encima del total central, sin textos encimados.",
    "Mejora: Al firmar un checklist incompleto aparece un diálogo en la app (con lista de celdas faltantes), banner ámbar y resaltado en rojo de los campos por completar — ya no depende del alert() del navegador.",
    "Nuevo: El checklist diario no se puede enviar incompleto: checks y lecturas (número/texto) son obligatorios; las observaciones vacías se guardan como N/A. Validación en pantalla y en el servidor (también al sincronizar offline).",
    "Nuevo: Recordatorio por Telegram si el checklist del día no está enviado (por defecto a las 10:00, 14:00 y 16:00 hora México). Configurable con CHECKLIST_REMINDER_HOURS.",
    "Nuevo: Código de activos MTTO-NNNN-S-DDD-T (reemplaza ACT-XXXX en altas nuevas). NNNN por nombre de equipo, S = sección A–E o X, DDD = duplicado en la misma zona (mismo nombre), T = F (fijo) / C (controlable). Se regenera al editar nombre, zona, sección o tipo.",
    "Nuevo: Campo obligatorio Tipo de activo — Activo fijo (F) o Controlable (C) — en alta/edición; visible en detalle y listado.",
    "Nuevo: Campo Sección (A–E) en activos de zonas L1–L5. Obligatorio al crear/editar en esas líneas; se oculta y limpia en otras zonas. Visible en detalle y listado, con filtro por sección cuando filtras una zona Lx.",
    "Mejora: El PDF/impresión del listado de Órdenes de Trabajo es más compacto (A4 horizontal): tabla densa en lugar de tarjetas, encabezado fino y ~10–15 filas por hoja.",
    "Corrección: El PDF/impresión de Órdenes de Compra ya no deja ~3 páginas en blanco al final; solo genera las hojas que ocupa el contenido (A4 vertical).",
    "Corrección: Fechas de calendario (fecha esperada de OC, turnos/roster) ya no se guardan como medianoche UTC (que en México mostraba el día anterior). Listados, PDF y CSV usan formato México (dd/mm) de forma uniforme.",
    "Corrección: Las fechas de movimientos (e órdenes) del CSV Fiix se interpretan como día/mes/año (ej. 05/07/2026 = 5 de julio, no 7 de mayo) y se muestran en formato México sin correr el día por UTC.",
    "Corrección: El PDF/impresión de Órdenes de Compra ya no duplica el contenido (antes salían ~4 hojas idénticas en OC recibidas) y fuerza A4 vertical (retrato).",
    "Nuevo: En Opciones de Desarrollador → Limpiar fotos huérfanas (escanea uploads/ vs BD y borra archivos no referenciados; confirma con LIMPIAR). Vaciar BD también puede borrar uploads/ (checkbox activado por defecto).",
    "Corrección: Movimientos de recepción de OC usan la fecha/hora exacta del momento de recibir (aunque llegue antes de lo pactado) y el listado ya no corta a 1000 (el CSV con fechas futuras los ocultaba). PDF de OC en vertical.",
    "Mejora: En recepción de OC se muestran dos montos — Total pedido (orden original) y Total recibido (cantidad real × costo unit.); también subtotales por línea al recibir o ya recibida.",
    "Nuevo: Recepción parcial de Órdenes de Compra — al recibir puedes indicar cantidad real por línea (más o menos que lo pedido); solo lo recibido entra al inventario y queda registrado pedido vs recibido.",
    "Mejora: install.sh / update.sh listos para servidor nuevo sin fallos típicos de 502: arranque PM2 con node dist/index.js, Node 22 por defecto, smoke test con reintentos, chmod de scripts tras pull, defaults S para PM2 startup y nginx+healthcheck. README con checklist de despliegue y tabla de fallos.",
    "Nuevo: Exportación nativa a Excel (.xlsx) — Órdenes (lista filtrada), Inventario/Repuestos (filtrados) y KPIs (libro multi-hoja del periodo). Se mantiene CSV e impresión donde ya existían.",
    "Corrección crítica: tsc genera dist/index.js (rootDir=src); el start de PM2 ya no busca un archivo inexistente y deja de fallar el healthcheck en :3000. update.sh vuelve a marcarse ejecutable tras git restore.",
    "Corrección crítica: en Ubuntu/PM2 el backend ya no usa nodemon (fallaba con «nodemon: not found» y dejaba 502). Arranca con node dist/index.js y update.sh recrea el proceso con cwd correcto.",
    "Corrección: update.sh aplica prisma db push con --accept-data-loss para no abortar el deploy (p. ej. unique client_request_id) y dejar nginx en 502.",
    "Nuevo: Sala de control en Inicio (admin/gestionador): tarjetas de Urgentes, Sin asignar, SLA en riesgo y SLA vencido; abren Órdenes filtradas. Badge en la pestaña del navegador y sonido opcional al subir el conteo crítico.",
    "Nuevo: Offline ampliado — puedes editar/enviar el checklist diario y registrar salidas de inventario (OUT) sin señal; las entradas (IN) siguen requiriendo conexión. Las salidas usan una clave anti-doble descuento al sincronizar.",
    "Mejora: Al descartar la cola offline también se limpian las fotos guardadas en el dispositivo; avisos más claros si un sync falla por conflicto (409) con fotos.",
    "Mejora: La app carga pantallas bajo demanda (code-splitting) para arrancar más rápido en celular/Tailscale.",
    "Cambio: Node.js recomendado 22+ (install.sh / update.sh / .nvmrc).",
    "Mejora: update.sh pregunta si quieres actualizar la conf nginx (body 500M) para no olvidar el 413 al subir zips; también UPDATE_NGINX=1.",
    "Mejora: El listado de Órdenes carga más rápido (~750 OT): ya no trae firmas base64 ni árboles RCA; el detalle sigue pidiendo esos datos al abrir.",
    "Mejora: Galería Antes/Después con miniaturas de tamaño fijo y zoom al tocar (menos huecos blancos).",
    "Mejora: Al finalizar una OT sin señal, las fotos se guardan en el dispositivo y se suben solas al recuperar conexión.",
    "Nuevo: En el detalle de una OT puedes pasar a la anterior/siguiente de la lista filtrada con ← → (como en Inventario).",
    "Corrección: La búsqueda global (Cmd/Ctrl+K) prioriza y reconoce folios FOL-0001 (también con espacios o guiones raros).",
    "Corrección: La búsqueda de órdenes reconoce folios FOL-0001 (antes solo coincidía el patrón interno wo-0001).",
    "Cambio: Al importar el zip de solicitudes, FOTO ANTES solo se guarda como evidencia del técnico (Antes), no como foto al levantar la solicitud.",
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
          
          <img src="/lpet.png" alt="GTZ Logo" className="h-16 object-contain mb-3" />
          <h2 className="text-2xl font-black text-white tracking-widest uppercase">GTZ CMMS</h2>
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
