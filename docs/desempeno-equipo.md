# Desempeño del equipo

Tablero para detectar si los técnicos atienden de verdad las solicitudes, con señales
difíciles de falsear. Nada está fijado en código: **los técnicos se descubren en cada
consulta** (usuarios activos con rol Técnico o Gestionador) y **todos los parámetros son
configurables desde la app** en *Configuración → Desempeño del equipo* o con el botón
**Parámetros** del tablero (`/stats/team`).

## Dónde está

- **Tablero**: Estadística → Desempeño del equipo (`/stats/team`).
- **Parámetros**: botón *Parámetros* del tablero, o Configuración → Desempeño del equipo.
  Solo **ADMINISTRADOR** y con **contraseña de desarrollador**.
- Accesos rápidos: Inicio (tarjeta) y encabezado de Indicadores.

## Métricas

| Métrica | Cálculo | Notas |
|---|---|---|
| **Atención** | mediana de (inicio − asignación) en minutos | Usa `assigned_at`; en órdenes antiguas cae a `created_at`. Incluye espera en cola. |
| **Utilización** | horas de labor ÷ horas de turno del roster | Las horas de labor vienen de `accumulated_time_ms` (sin pausas). Requiere turnos registrados. |
| **Resuelto a la primera (FTF)** | correctivas cerradas sin otra correctiva del mismo activo en `rework_days` ÷ correctivas cerradas | Solo correctivas; una preventiva posterior no cuenta como reincidencia. |
| **SLA** | cerradas antes de la fecha comprometida ÷ cerradas con fecha | Requiere `due_date`. |
| **Evidencia** | cierres con foto, firma, nota o refacción ÷ cerradas | Castiga el «cerrar por cerrar». |
| **Backlog viejo** | OT sin iniciar más antiguas que `backlog_days` | Detecta trabajo escondido. |

## Índice y semáforo

- **Modo fijo**: cada métrica se normaliza contra su meta (0 a 1) y se pondera con los pesos configurados.
- **Modo relativo**: cada métrica se convierte en percentil dentro del grupo (por turno o todo el equipo).
- El índice es 0-100; verde/ámbar/rojo según umbrales configurables.
- Si un técnico tiene menos OT que `min_sample`, el índice se oculta («muestra insuficiente»).

## Banderas anti-juego

| Bandera | Regla por omisión |
|---|---|
| Cierre exprés | menos de 5 min, sin evidencia y sin refacción |
| Aceptar sin iniciar | OT asignadas sin iniciar después de 48 h |
| Ping-pong | `reassignment_count` ≥ 2 |
| Evidencia repetida | misma foto (hash MD5) en más de una OT del periodo |
| Fin de turno | cierre en los últimos 30 min antes del fin de turno del roster |
| Selección de trabajo | porcentaje de preventivas 20 puntos por encima del equipo |
| Evidencia baja | evidencia por debajo del 90 % |

## Configuración (JSON en `SystemSettings.performance_config`)

| Campo | Uso |
|---|---|
| `mode` | `relative` \| `fixed` |
| `compare` | `shift` \| `all` (valor por omisión; el tablero también permite cambiarlo) |
| `period_days`, `min_sample`, `rework_days`, `backlog_days` | ventanas y tamaño de muestra |
| `weights` | pesos de las seis dimensiones |
| `targets` y `targets_by_code` | metas globales y por código de turno |
| `flags` | umbrales de las banderas |
| `hours_by_code`, `shift_end_by_code` | horario por código del roster (`D`, `N`, `M`, …) |
| `thresholds` | verde/ámbar del semáforo |

Cualquier campo faltante o inválido cae a los valores sugeridos (`normalizePerformanceConfig`),
así que una configuración vieja nunca rompe el tablero. Los cambios se registran en la
bitácora de auditoría (`PERFORMANCE_SETTINGS_UPDATED` / `PERFORMANCE_SETTINGS_RESET`).

## API

| Ruta | Permiso |
|---|---|
| `GET /api/performance/settings` | autenticado |
| `GET /api/performance/team?period=&compare=` | autenticado |
| `POST /api/performance/team/preview` | autenticado (cálculo sin guardar) |
| `PUT /api/performance/settings` | ADMINISTRADOR + `x-dev-password` |
| `POST /api/performance/settings/reset` | ADMINISTRADOR + `x-dev-password` |

## Pruebas

```bash
cd backend
bash scripts/run-performance-team-test.sh
```

Cubre normalización de configuración, metas por turno, modo fijo y relativo, muestra
insuficiente, cierre exprés, ping-pong, backlog viejo y aceptar sin iniciar.
