# Asistente GTZ AI (Nivel 2) — Preview

> **Estado:** preview en `v1.72.0-preview.1` (27 de octubre de 2026). No es una versión estable; la configuración, los modelos y la interfaz pueden cambiar antes del release definitivo.

Asistente de chat disponible en la esquina inferior derecha de la appweb. Consulta datos reales de PostgreSQL mediante **herramientas de solo lectura** y responde en español con Markdown, tablas, listas y sugerencias.

## Qué puede hacer

| Herramienta | Datos que consulta |
|---|---|
| `get_work_orders` | Órdenes por estado, prioridad, tipo, zona, equipo, texto o fechas. |
| `get_work_order_detail` | Detalle de una OT por folio, incluyendo repuestos utilizados. |
| `search_inventory` | Repuestos, stock actual/mínimo, ubicación y alertas de stock bajo. |
| `get_assets` | Activos por estado, criticidad, zona o texto. |
| `get_maintenance_summary` | Resumen de planta: órdenes abiertas, vencidas, paros, equipos fuera y stock crítico. |
| `get_roster_today` | Personal en turno para una fecha. |
| `get_app_guide` | Guías para crear/cerrar OTs, firmas, QR, preventivos, checklist, reportes, compras y fotos. |

El asistente **no puede crear, editar, cerrar ni borrar** registros. Si se le pide una acción, explica los pasos para hacerla dentro de la app.

## Seguridad y alcance

- Requiere JWT válido; el rol y los permisos se leen de la base de datos.
- Los usuarios sin `VIEW_ALL_WORK_ORDERS` (normalmente `TECNICO`) solo ven **sus órdenes asignadas**.
- Los costos de inventario se ocultan a roles sin `MANAGE_INVENTORY`.
- La API Key vive únicamente en el `.env` del servidor; nunca se envía al navegador.
- Rate limit: **20 solicitudes por 5 minutos por usuario**.
- Los errores del proveedor se registran en el servidor y se devuelven al cliente con mensajes genéricos.
- Cada mensaje se limita a 4,000 caracteres; el contexto enviado se limita a 15 mensajes y 20,000 caracteres.

## Configuración

Variables principales en el `.env` de la raíz (Docker) o en `backend/.env` (desarrollo local):

```env
AI_ENABLED=true
AI_API_KEY="tu_clave"
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL="deepseek/deepseek-v4.1-flash"
```

Opcionales:

```env
AI_FALLBACK_MODEL="nvidia/nemotron-3.5-lightning:free"
AI_MAX_TOKENS=1400
AI_TIMEOUT_MS=45000
AI_MAX_TOOL_ROUNDS=4
AI_TIMEZONE="America/Mexico_City"
AI_APP_URL="https://cmms.ejemplo.com"
AI_DEBUG=false
```

`AI_FALLBACK_MODEL` es opcional. Si el modelo principal devuelve falta de crédito, cuota, 429 o un modelo no disponible, el backend reintenta una vez con el respaldo y conserva el mismo flujo de herramientas. El respaldo debe usar el mismo `AI_BASE_URL` y soportar `tools`.

Después de cambiar variables en Docker:

```bash
sudo docker compose up -d --build
```

No hace falta reconstruir la imagen si solo se reinicia el contenedor, pero `--build` es la forma segura de aplicar cambios de código.

## Proveedores

### OpenRouter (configuración actual)

```env
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL="deepseek/deepseek-v4.1-flash"
```

- OpenRouter **no tiene** una variante `:free` de DeepSeek V4.1 Flash. El modelo indicado es de pago, con un costo muy bajo por consulta.
- Una alternativa gratuita con soporte de herramientas es `nvidia/nemotron-3.5-lightning:free`.
- La clave de OpenRouter se crea en <https://openrouter.ai/keys>.

### Modo 100% gratuito con OpenRouter

```env
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL="nvidia/nemotron-3.5-lightning:free"
AI_FALLBACK_MODEL="nvidia/nemotron-3-ultra-550b-a55b:free"
```

- `nvidia/nemotron-3.5-lightning:free` es la opción más equilibrada y ya fue probada como respaldo.
- `openrouter/free` enruta automáticamente a un modelo gratuito; es cómodo, pero la calidad y la latencia varían.
- `google/gemma-4-31b-it:free` es otra alternativa con tool calling.
- Límites de OpenRouter para modelos free: **20 solicitudes/minuto** y **50/día** si has comprado menos de $10 en créditos; **1,000/día** si has comprado al menos $10. Los modelos `:free` siguen costando $0.
- El límite es de la cuenta: crear más API keys no lo evita. El fallback no evita el tope diario.
- No todos los modelos gratuitos soportan tools; verifica que declaren `tools` antes de usarlos.

### Alternativas gratuitas

- **Google AI Studio / Gemini API free tier:** endpoint compatible con OpenAI (`https://generativelanguage.googleapis.com/v1beta/openai/`); usa el modelo flash vigente del catálogo gratuito. Tiene límites por minuto/día y, en free tier, Google puede usar los datos para mejorar sus productos.
- **Groq / Cerebras:** capa gratuita para desarrollo, muy rápida y compatible con OpenAI; revisa los modelos con tools y los límites vigentes.
- **Ollama local:** 100% gratis y privado, sin límites de API; requiere hardware y un modelo con tool calling. Es la mejor opción si los datos no deben salir de la empresa.
- **OpenCode Zen free:** `deepseek-v4.1-flash-free` requiere API key de OpenCode y puede rechazar clientes externos; no es la opción más estable para este backend.

### OpenCode Zen (DeepSeek free)

```env
AI_BASE_URL="https://opencode.ai/inference/openai/v1"
AI_MODEL="deepseek-v4.1-flash-free"
```

- Requiere una API key de OpenCode Console.
- La documentación de OpenCode indica que los modelos free están pensados para usarse desde OpenCode y **pueden no aceptar clientes externos**. Si el endpoint devuelve 401/403, usa OpenRouter o un modelo de pago de OpenCode.

## Prueba rápida

```bash
# 1) Estado del asistente (requiere JWT)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/ai/status

# 2) Consulta con herramientas
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"¿Cuántas órdenes pendientes hay y qué repuestos tienen stock bajo?"}]}'
```

En la interfaz, el botón **Asistente IA** abre el panel. Las respuestas muestran la etiqueta **Consultado** con las herramientas usadas.

## Diagnóstico

| Síntoma | Causa probable |
|---|---|
| `503` “no tiene una API Key configurada” | Falta `AI_API_KEY` o el contenedor no se reinició. |
| `503` “API Key no válida” | Clave incorrecta, sin acceso al modelo o modelo inexistente. |
| `503` “no tiene saldo” | El modelo es de pago y la cuenta no tiene crédito. |
| `429` | Rate limit local o límite/créditos del proveedor. Si configuraste `AI_FALLBACK_MODEL`, el servidor intenta el respaldo una vez. |
| `504` | El proveedor tardó más de `AI_TIMEOUT_MS`; prueba una pregunta más concreta. |
| Respuesta sin datos reales | Revisa los logs `[GTZ AI Error]` y confirma que el modelo soporta `tools`. |
| El técnico no ve todas las órdenes | Es el comportamiento esperado sin `VIEW_ALL_WORK_ORDERS`. |

> **Rotación de claves:** si una API Key se comparte en un chat, en un ticket o en un repositorio, rótala en el proveedor y actualiza solo el `.env` del servidor. Nunca la subas a Git.

## Limitaciones de la preview

- El asistente es de **solo lectura**: no reemplaza los flujos de creación, edición o cierre de la app.
- La calidad de las respuestas depende del modelo; los modelos gratuitos pueden ser más lentos, tener menos contexto útil o cambiar de disponibilidad.
- Los límites del proveedor (especialmente los modelos `:free`) pueden agotarse en un equipo con varios usuarios.
- Revisa la política de datos del proveedor antes de enviar información sensible. Los planes gratuitos pueden usar los prompts para entrenamiento.
- La base `fiix_cmms_review` usada en las pruebas está vacía de órdenes, activos y repuestos; para validar con datos reales usa una copia controlada, nunca producción sin respaldo.
