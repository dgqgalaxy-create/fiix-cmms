/**
 * @deprecated v1.26.3 — Los interceptores globales de axios rompían el sync offline
 * (re-encolaban errores de red aunque hubiera conexión y contaminaban el axios "crudo"
 * de App.tsx). La cola offline vive solo en `api/axios.ts` (instancia `api`).
 * Este módulo se conserva vacío para no romper imports antiguos.
 */

export {};
