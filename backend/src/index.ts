import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

import { initSocket } from './utils/socket';
import { assertJwtConfigured } from './utils/auth';
import { corsOriginDelegate } from './utils/corsOrigins';
import { requireUploadAccess } from './middlewares/authMiddleware';

assertJwtConfigured();

// Restart trigger

const app = express();
const server = http.createServer(app);

// Inicializar WebSockets
initSocket(server);

const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
  })
);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
app.use(
  '/uploads',
  requireUploadAccess,
  express.static(path.join(__dirname, '../uploads'), {
    fallthrough: false,
    index: false,
  })
);

import authRoutes from './routes/authRoutes';
import assetRoutes from './routes/assetRoutes';
import workOrderRoutes from './routes/workOrderRoutes';
import kpiRoutes from './routes/kpiRoutes';
import permissionRoutes from './routes/permissionRoutes';
import userRoutes from './routes/userRoutes';
import zoneRoutes from './routes/zoneRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import maintenanceRoutes from './routes/maintenanceRoutes';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes';
import rcaRoutes from './routes/rcaRoutes';
import devRoutes from './routes/devRoutes';
import publicRoutes from './routes/publicRoutes';
import checklistRoutes from './routes/checklistRoutes';
import settingsRoutes from './routes/settingsRoutes';
import notificationRoutes from './routes/notificationRoutes';
import requesterRoutes from './routes/requesterRoutes';
import rosterRoutes from './routes/rosterRoutes';
import searchRoutes from './routes/searchRoutes';
import auditRoutes from './routes/auditRoutes';
import versionRoutes from './routes/versionRoutes';
import notesRoutes from './routes/notesRoutes';
import chatRoutes from './routes/chatRoutes';
import { initCronJobs } from './utils/cronJobs';
import { pingDatabase } from './utils/dbHealthCheck';

app.get('/api/health', async (_req: Request, res: Response) => {
  const dbOk = await pingDatabase();
  const db = dbOk ? 'ok' : 'error';
  const status = dbOk ? 'ok' : 'degraded';
  let version = 'unknown';
  try {
    version = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
    ).version;
  } catch {
    /* ignore */
  }
  res.status(dbOk ? 200 : 503).json({
    status,
    db,
    version,
    message: dbOk ? 'CMMS API is running' : 'CMMS API is up but database is unreachable',
  });
});

// Import and use routes here
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/rca', rcaRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/users', userRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/requesters', requesterRoutes);
app.use('/api/roster', rosterRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/chat', chatRoutes);

/** Errores de multer (tamaño / tipo) → 400 JSON legible */
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (!err) {
    next();
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  if (code === 'LIMIT_FILE_SIZE' || /file size|File too large/i.test(msg)) {
    res.status(400).json({ error: 'Archivo demasiado grande (máx. 12 MB para fotos de OT/portal).' });
    return;
  }
  if (/Solo se permiten imágenes|Solo se permiten imágenes o PDF|Tipo de archivo/i.test(msg) || code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ error: msg || 'Archivo no permitido' });
    return;
  }
  next(err);
});

/** Errores no capturados → JSON (respeta status 404 de express.static fallthrough:false). */
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status =
    typeof err === 'object' && err && 'status' in err
      ? Number((err as { status?: number }).status)
      : 0;
  if (status === 404) {
    res.status(404).json({ error: 'Archivo no encontrado' });
    return;
  }
  console.error('[GTZ] Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[GTZ] unhandledRejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[GTZ] uncaughtException:', error);
});

// Producción: Express sirve el frontend ya compilado (frontend/dist) en el mismo
// puerto que la API, para no depender de un segundo proceso Vite en :5173.
// Se coloca DESPUÉS de las rutas /api para no interferir con ellas ni con /uploads.
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  // index.html / sw.js sin cache largo: si no, el SW o el browser pueden
  // servir el shell viejo tras ./update.sh y el banner de versión no avanza.
  app.use(
    express.static(frontendDistPath, {
      setHeaders(res, filePath) {
        const base = path.basename(filePath);
        if (
          base === 'index.html' ||
          base === 'sw.js' ||
          base === 'registerSW.js' ||
          base === 'manifest.webmanifest' ||
          /^workbox-.+\.js$/i.test(base)
        ) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
        } else if (/\.[a-f0-9]{8,}\.(js|css)$/i.test(base)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  console.log('[GTZ] Sirviendo frontend/dist en este mismo puerto (modo producción de un solo proceso).');
} else {
  console.log('[GTZ] frontend/dist no encontrado; solo se sirve la API (usa "cd frontend && npm run dev" para la UI en desarrollo).');
}

// Initialize Cron Jobs
initCronJobs();

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

