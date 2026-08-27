# Estrategia de Backups — GTZ CMMS

**Importante:** La base de datos PostgreSQL es el **corazón del sistema**. Un backup fallido = pérdida total de datos históricos, órdenes de trabajo, activos, etc.

---

## 🎯 Objetivo

Garantizar que en caso de fallo de servidor, corrupción de datos o ataque, puedas:
1. Restaurar la BD a un punto conocido (último backup)
2. Recuperar uploads (evidencias de OTs, fotos de refacciones)
3. Restaurar configuración del servidor (`.env`)

---

## 📦 Qué Respaldar

| Componente | Localización | Frecuencia | Criticidad |
|---|---|---|---|
| **Base de datos PostgreSQL** | En el servidor | Diaria (automática) | 🔴 Crítica |
| **Uploads** (evidencias, fotos) | `backend/uploads/` | Diaria (automática) | 🟠 Alta |
| **Configuración** | `backend/.env` | Manual (antes de cambios) | 🟡 Media |
| **Código** | `main` branch en GitHub | Automática (ya en Git) | 🟢 Baja |

---

## 🚀 Opción A: Backups Automáticos en Ubuntu (Recomendado)

### Paso 1: Crear carpeta de backups

```bash
sudo mkdir -p /backups/fiix-cmms
sudo chown $USER:$USER /backups/fiix-cmms
chmod 700 /backups/fiix-cmms
```

### Paso 2: Script de backup diario (`/usr/local/bin/fiix-backup.sh`)

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/fiix-cmms"
DB_NAME="fiix_cmms"
DB_USER="postgres"
UPLOADS_DIR="$HOME/fiix-cmms/backend/uploads"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Log function
log_msg() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$BACKUP_DIR/backup.log"
}

log_msg "=== Inicio backup ==="

# 1. Backup de BD (con compresión gzip)
log_msg "Respaldando BD PostgreSQL..."
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"
if [ $? -eq 0 ]; then
  log_msg "✓ BD respaldada: db_$TIMESTAMP.sql.gz"
else
  log_msg "✗ ERROR: Fallo el backup de BD"
  exit 1
fi

# 2. Backup de uploads (solo si cambió)
log_msg "Respaldando uploads..."
if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C "$HOME/fiix-cmms/backend" uploads/
  if [ $? -eq 0 ]; then
    log_msg "✓ Uploads respaldados: uploads_$TIMESTAMP.tar.gz"
  else
    log_msg "✗ ERROR: Fallo el backup de uploads"
  fi
else
  log_msg "⚠ Carpeta uploads no existe (normal si no hay evidencias aún)"
fi

# 3. Backup de .env
log_msg "Respaldando .env..."
cp "$HOME/fiix-cmms/backend/.env" "$BACKUP_DIR/.env_$TIMESTAMP"
log_msg "✓ .env respaldado"

# 4. Limpiar backups antiguos (mantener últimos 30 días)
log_msg "Limpiando backups antiguos (>30 días)..."
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name ".env_*" -mtime +30 -delete
log_msg "✓ Limpieza completada"

log_msg "=== Backup completado exitosamente ===" 
```

### Paso 3: Instalar script en cron (ejecutar a las 2 AM diariamente)

```bash
sudo cp /path/a/fiix-backup.sh /usr/local/bin/fiix-backup.sh
sudo chmod +x /usr/local/bin/fiix-backup.sh

# Agregar a crontab (como root para acceso a pg_dump)
sudo crontab -e
# Pegar: 0 2 * * * /usr/local/bin/fiix-backup.sh >> /backups/fiix-cmms/backup.log 2>&1
```

### Paso 4: Verificar backups

```bash
# Ver últimos backups
ls -lh /backups/fiix-cmms/

# Ver log
tail -f /backups/fiix-cmms/backup.log
```

---

## 🔄 Opción B: Backups a la Nube (Extra — para servidores críticos)

Si el servidor está en AWS/Azure/Google Cloud, considera:

### AWS RDS (Base de Datos Administrada)
- PostgreSQL gestionado con backups automáticos
- Snapshots automáticos + retención configurable
- Costo: $$$

### Alternativa: Backup a S3 / Google Storage

```bash
# Agregar a fiix-backup.sh después de crear db_$TIMESTAMP.sql.gz:

# Copiar a AWS S3
aws s3 cp "$BACKUP_DIR/db_$TIMESTAMP.sql.gz" "s3://mi-bucket-backups/fiix-cmms/"

# O a Google Cloud Storage
gsutil cp "$BACKUP_DIR/db_$TIMESTAMP.sql.gz" "gs://mi-bucket-backups/fiix-cmms/"
```

---

## ✅ Restauración de Backups

### Restaurar Base de Datos

```bash
# 1. Detener la app
pm2 stop fiix-backend

# 2. Descomprimir y restaurar
gunzip < /backups/fiix-cmms/db_20260826_020000.sql.gz | psql -U postgres -d fiix_cmms

# 3. Reiniciar
pm2 start fiix-backend
```

### Restaurar Uploads

```bash
cd ~/fiix-cmms/backend
tar -xzf /backups/fiix-cmms/uploads_20260826_020000.tar.gz
```

### Restaurar .env

```bash
cp /backups/fiix-cmms/.env_20260826_020000 ~/fiix-cmms/backend/.env
# Editar si algo cambió desde el backup
```

---

## 🔍 Checklist de Validación

Después de restaurar, verifica:

- [ ] **BD accesible:** `psql -U postgres -d fiix_cmms -c "SELECT COUNT(*) FROM usuarios;"`
- [ ] **App inicia:** `pm2 start fiix-backend && pm2 logs fiix-backend`
- [ ] **Web accessible:** `curl http://localhost:3000`
- [ ] **Socket.IO conecta:** Abre navegador → DevTools → Network → chequea conexión WebSocket
- [ ] **Datos correctos:** Login y verifica últimas OTs, activos, etc.

---

## ⚠️ Mejores Prácticas

| Práctica | Beneficio |
|----------|-----------|
| Backup **diario** | Máximo 1 día de pérdida de datos |
| Retención **30 días** | Recupera cambios accidentales recientes |
| **Test de restauración** mensual | Detecta problemas antes de que sea emergencia |
| Almacenar en **servidor diferente** | Protege contra fallo del disco principal |
| **Encriptar** backups en tránsito | Confidencialidad de datos sensibles |
| Documentar **cuándo** y **cómo** restaurar | Evita confusión en crisis |

---

## 🚨 Plan de Contingencia (Disaster Recovery)

### Escenario: Servidor caído

1. **Diagnosticar** (5 min): ¿BD no responde? ¿Disco lleno? ¿Red caída?
2. **Recuperar servidor** (15 min): Reiniciar, provisionar nuevo, etc.
3. **Restaurar BD** (5 min): Ejecutar comando de restauración arriba
4. **Validar data** (10 min): Checklist arriba
5. **Informar usuarios** (cuando esté listo)

**Tiempo total esperado:** < 40 minutos

---

## 📊 Monitoreo

Agrega alertas en tu servidor (Telegram via SLA del proyecto):

```bash
# Ejemplo: alertar si backup falla
if [ ! -f "$BACKUP_DIR/db_$(date +%Y%m%d)*.sql.gz" ]; then
  curl -X POST https://api.telegram.org/bot$TOKEN/sendMessage \
    -d "chat_id=$CHAT_ID&text=⚠️ Backup de fiix-cmms no se ejecutó hoy"
fi
```

---

## 📚 Referencias

- PostgreSQL Backups: https://www.postgresql.org/docs/current/backup-dump.html
- PM2 Management: https://pm2.keymetrics.io/
- Cron Job Reference: https://crontab.guru/

---

**Última revisión:** 26 de agosto de 2026  
**Próxima revisión recomendada:** 26 de septiembre de 2026
