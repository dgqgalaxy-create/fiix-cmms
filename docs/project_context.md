# Contexto Global del Proyecto (CMMS)

## ¿Qué estamos construyendo?
Un Sistema Computarizado de Gestión de Mantenimiento (CMMS / GMAO) de clase mundial diseñado específicamente para entornos industriales. Inspirado en plataformas robustas como Fiix o SAP PM, pero con una experiencia de usuario (UX/UI) moderna, extremadamente rápida e intuitiva.

## Filosofía de Diseño
- **Estética Premium:** Colores vibrantes (Indigo, Emerald, Rose), interfaces limpias, animaciones fluidas, y un diseño enfocado en la usabilidad tanto en escritorio como en dispositivos móviles.
- **Rendimiento:** Interfaces optimizadas (ej. paginación), evitando recargas innecesarias (React, Vite).
- **Automatización:** Minimizar clics (autocompletado de imágenes web, alertas de stock crítico automáticas).

## Módulos Desarrollados (Completados)
1. **Autenticación y Usuarios:** Roles (Admin, Gestionador, Técnico).
2. **Dashboard de Inicio:** KPIs en tiempo real (Órdenes abiertas, stock crítico, activos inactivos).
3. **Gestión de Activos:** Catálogo de máquinas y ubicaciones jerárquicas.
4. **Órdenes de Trabajo (WO):** Creación de reportes, firma digital, toma de fotografías, estado de "En Progreso" y asignación de técnicos.
5. **Inventario de Repuestos:** Control de refacciones (Categorías, Ubicaciones, Proveedores).
6. **Módulo de Reabastecimiento:** Alertas de stock crítico, paginación masiva, y generador automatizado de Órdenes de Compra en formato texto. Búsqueda inteligente de imágenes de refacciones en internet.

## Estrategia de Migración de Datos (Día Cero)
Existe una carpeta `data/` que almacena los archivos `.csv` exportados del sistema anterior (Fiix). Estos archivos alimentan al script migrador (`backend/src/seed_csv.ts`).
**AVISO CRÍTICO PARA FUTURAS MIGRACIONES:**
Faltan integrar los archivos base para migrar el **historial de Órdenes de Mantenimiento (Work Orders)**. Cuando el usuario provea estos archivos, se deberá alinear exhaustivamente el formato y las cabeceras del `.csv` para que sean 100% compatibles con el esquema de la base de datos actual antes de importarlos.

## Tecnologías
- **Frontend:** React, TypeScript, TailwindCSS, Vite, Lucide React (Íconos).
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL.
