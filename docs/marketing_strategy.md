# Estrategia de Negocio y Marketing (FIIX / LPET CMMS)

Este documento recopila las estrategias de comercialización, modelos de venta y ventajas competitivas del CMMS para guiar las futuras fases de marketing y expansión comercial del producto.

## Ventajas Competitivas (Argumentos de Venta)
Al acercarte a un cliente potencial, estos son los puntos técnicos que diferencian a nuestro sistema de la competencia (SAP PM, Fiix básico, etc.):

1. **Tiempo casi real (Socket.IO):**
   - *El Problema:* Los sistemas tradicionales son lentos y requieren refrescar la página.
   - *Nuestra Solución:* Listados y catálogos se actualizan al momento cuando alguien reporta o edita en planta.
2. **Portal Público sin Licencias Extra:**
   - *El Problema:* Cobrar licencia por cada operador que solo quiere reportar una falla encarece el producto.
   - *Nuestra Solución:* Cualquier operador puede usar `/request` (con foto opcional) sin cuenta ni contraseña.
3. **Escaneo QR Nativo:**
   - Activos, repuestos y ubicaciones con QR listos para imprimir; en celular funciona cámara (HTTPS) o galería (HTTP).
4. **Automatización Inteligente:**
   - Sugerencia de imágenes de refacciones (API de búsqueda web).
   - Alertas de stock crítico y borradores de OC; PMs por calendario; SLA con Telegram.
5. **Seguridad y Control (Regla Anti-Borrado):**
   - Integridad histórica: no se borran técnicos/activos con historial ligado.
6. **Self-hosted:**
   - Instancia en servidor propio (`install.sh` / `update.sh`); datos y fotos en tu infraestructura.

## Modelos de Venta (Estrategia Recomendada)

### Fase 1: Venta Directa / Instancia Dedicada (B2B) - **ESTADO ACTUAL**
*Recomendado para los primeros 6 a 12 meses de comercialización.*

- **¿En qué consiste?** Acercarse a fábricas medianas/grandes y venderles una implementación "llave en mano" con su propio servidor privado.
- **¿Cómo se cobra?**
  - **Setup Inicial (Fuerte):** Entre $2,000 y $10,000 USD (dependiendo del tamaño) por instalar, poblar catálogos iniciales y capacitar.
  - **Iguala Mensual (Retainer):** Entre $300 y $800 USD por mantenimiento del servidor y soporte (opcional; también puede operar 100% on-prem sin nube de pago).
- **Ventajas:**
  - Flujo de caja inmediato para financiar el crecimiento.
  - Producto **listo para piloto B2B** en una planta; el backlog (LOTO, CBM, multiplanta, offline total) no bloquea el valor core de OT/inventario/PMs.
  - Privacidad: datos no mezclados con otras fábricas.
  - Feedback cara a cara con la industria.

### Fase 2: Suscripción Masiva en la Nube (SaaS) - **FUTURO**
*Recomendado cuando el sistema haya sido probado en 3-5 fábricas reales.*

- **¿En qué consiste?** Una página web automatizada donde empresas pasan tarjeta y crean cuenta sin intervención manual.
- Requiere multi-tenant, billing y endurecimiento de seguridad/ops — ver backlog en `docs/roadmap.md`.
