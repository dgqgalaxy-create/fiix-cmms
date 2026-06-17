#!/bin/bash

# Cargar el entorno de Node.js (necesario si usas NVM)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "=== Iniciando actualización del CMMS ==="

# 1. Preparar el terreno y descargar el código más reciente
echo "Limpiando archivos locales y descargando nuevos cambios..."
cd ~/fiix-cmms
git restore .
git pull

# 2. Actualizar el cerebro (Backend)
echo "Actualizando el Backend..."
cd ~/fiix-cmms/backend
npm install
npx prisma generate
npx prisma db push

# 3. Actualizar la cara visual (Frontend)
echo "Actualizando el Frontend..."
cd ~/fiix-cmms/frontend
npm install

# 4. Reiniciar los vigilantes
echo "Reiniciando los sistemas..."
pm2 restart fiix-backend fiix-frontend

echo "=== ¡Actualización completada con éxito! ==="
