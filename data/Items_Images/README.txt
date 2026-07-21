Fotos de repuestos (Items) para importación CSV
================================================

Coloca aquí las fotos de los repuestos ANTES de importar los CSV desde
Opciones de Desarrollador (con la casilla «También asignar fotos…» activada).

Esta carpeta usa el nombre exacto del export de Fiix: Items_Images

Nombre del archivo
------------------
El export de Fiix nombra cada foto así (columna «Image» del CSV
Items - Items.csv apunta a la misma ruta relativa):

  {Item ID}.Image.{HHMMSS}.{ext}

Donde «Item ID» es el código interno del repuesto (columna Item ID /
campo internal_code). Extensiones: .jpg .jpeg .png .webp .gif

Ejemplos reales:
  MTTO-0001.Image.163526.png
  MTTO-0002.Image.071009.jpg
  MTTO-0005.Image.210151.png

También se acepta el nombre simplificado {Item ID}.jpg (sin el segmento
.Image.HHMMSS) por si renombras a mano.

El emparejamiento se basa en los archivos reales de esta carpeta: se
extrae el Item ID del nombre y se busca el ítem con ese internal_code.
Si un ítem ya recibió foto en la misma corrida, archivos extra se omiten.

Ruta en el servidor
-------------------
  <raíz-del-repo>/data/Items_Images/

En Windows local o Ubuntu es la misma carpeta relativa al proyecto.
No uses data/item-images/ (nombre antiguo; ya no aplica).

Qué hace la importación
-----------------------
1. Importa/actualiza los ítems desde el CSV.
2. Escanea esta carpeta.
3. Copia cada foto a backend/uploads/inventory/ con el mismo formato que la
   subida manual (image-{timestamp}-{aleatorio}.ext).
4. Actualiza el campo image_url del repuesto.

Si la carpeta está vacía o no existe, la importación CSV sigue igual (sin error).
Las fotos originales en esta carpeta NO se borran (se copian).
