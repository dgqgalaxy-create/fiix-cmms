# Scripts Históricos (Legacy)

Estos scripts fueron utilizados durante el desarrollo del proyecto para recuperar, reparar y migrar componentes. **No son necesarios para el funcionamiento normal del sistema** pero se documentan aquí con propósitos de auditoría y referencia histórica.

---

## 📋 Índice de Scripts

| Script | Propósito | Estado | Notas |
|--------|-----------|--------|-------|
| `fix_calendar.py` | Recuperar y reparar CalendarPage.tsx | ⚠️ Deprecado | Parsea transcriptos de sesiones previas |
| `fix_encoding.py` | Decodificar JSON en archivos | ⚠️ Deprecado | Usado para recuperar componentes mal guardados |
| `parse.js` | Extraer preguntas de HTML de sesiones | ⚠️ Deprecado | Parsing específico para formatos antiguos |
| `get_colors.py` | *Sin documentar* | 🔍 Por revisar | Ver abajo |

---

## 🔧 Descripción Detallada

### 1. `fix_calendar.py` — Recuperación de CalendarPage.tsx

**Contexto:** Recupera el componente `CalendarPage.tsx` desde un transcripto de sesión anterior (formato JSONL).

**Qué hace:**
- Lee transcriptos de herramientas anteriores (vía ruta Windows hardcodeada)
- Busca eventos `write_to_file` que contengan cambios a `CalendarPage.tsx`
- Aplica parches de configuración (vistas de calendario, idioma español, clases dark mode)

**Razón de uso:** Recuperación de cambios perdidos durante debugging de componente de calendario.

**Estado:** No es necesario — el código actual en `frontend/src/pages/CalendarPage.tsx` es la fuente única de verdad.

**Comando original:**
```bash
python fix_calendar.py
```

---

### 2. `fix_encoding.py` — Decodificación de Archivos

**Contexto:** Repara archivos que fueron guardados como literales de string JSON (escaped).

**Qué hace:**
- Verifica si `UserManual.tsx` y `CalendarPage.tsx` son strings JSON válidos
- Si lo son, decodifica (unescape) y sobrescribe el archivo
- Usa `utf-8` para evitar problemas de codificación

**Razón de uso:** Recuperación tras errores de serialización en flujo de guardado previo.

**Estado:** Problema resuelto en el pipeline actual de construcción.

**Comando original:**
```bash
python fix_encoding.py
```

---

### 3. `parse.js` — Extractor de Preguntas HTML

**Contexto:** Parsea HTML de formularios/cuestionarios desde sesiones de herramientas anteriores.

**Qué hace:**
- Busca divs con clase `M7eMe` (estructura HTML específica de formulario antiguo)
- Extrae preguntas y opciones de respuesta
- Imprime en formato legible

**Razón de uso:** Migración de datos de cuestionarios de sesiones heredadas.

**Estado:** No es necesario — los formularios actuales se definen en TypeScript/React.

**Comando original:**
```bash
node parse.js
```

---

### 4. `get_colors.py` — *Sin documentar*

**Estado:** 🔍 **Por revisar y documentar en próxima actualización**

---

## ⚠️ Advertencias

1. **No ejecutes estos scripts en producción** — están diseñados para desarrollo/recuperación.
2. **Rutas hardcodeadas:** Usan rutas específicas de Windows (`C:\Users\Mantenimiento\...`). Requerirían adaptación.
3. **Dependencias externas:** `fix_encoding.py` requiere Python 3.x; `parse.js` requiere Node.js.
4. **Sin tests:** No tienen casos de prueba automatizados.

---

## 🗑️ Limpieza Recomendada

Si el proyecto alcanza versión estable **v2.0+** sin necesidad de recuperación:

```bash
# Opcional: mover a carpeta archived/
mkdir -p docs/archived
mv fix_calendar.py fix_encoding.py parse.js get_colors.py docs/archived/

# Agregar a .gitignore si queda historial
echo "docs/archived/" >> .gitignore
```

---

## ✅ Alternativas Modernas

Para problemas similares, utiliza:

- **Recuperación de Git:** `git log -p`, `git reflog`, `git show <commit>`
- **Control de versiones:** Commits + branches en lugar de scripts ad-hoc
- **Tests automáticos:** Valida cambios mediante CI/CD antes de merge
- **Documentación:** Mantén changelogs en `CHANGELOG.md` o GitHub Releases

---

Última actualización: 26 de agosto de 2026
