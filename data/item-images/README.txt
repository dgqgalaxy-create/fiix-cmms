Fotos de repuestos (Items) para importación CSV
================================================

Coloca aquí las fotos de los repuestos ANTES de importar los CSV desde
Opciones de Desarrollador (con la casilla «También asignar fotos…» activada).

Nombre del archivo
------------------
Usa el código interno del ítem (columna «Item ID» del CSV Items - Items.csv),
sin espacios raros. La extensión puede ser cualquiera de: .jpg .jpeg .png .webp .gif

Ejemplos:
  MTTO-0001.jpg
  E2-0.png
  ACT-0012.webp

Si no hay coincidencia por código, se intenta emparejar por un «slug» del nombre
del repuesto (minúsculas, sin acentos, guiones en lugar de espacios).

Ruta en el servidor
-------------------
  <raíz-del-repo>/data/item-images/

En Windows local o Ubuntu es la misma carpeta relativa al proyecto.

Qué hace la importación
-----------------------
1. Importa/actualiza los ítems desde el CSV.
2. Escanea esta carpeta.
3. Copia cada foto a backend/uploads/inventory/ con el mismo formato que la
   subida manual (image-{timestamp}-{aleatorio}.ext).
4. Actualiza el campo image_url del repuesto.

Si la carpeta está vacía o no existe, la importación CSV sigue igual (sin error).
Las fotos originales en esta carpeta NO se borran (se copian).
