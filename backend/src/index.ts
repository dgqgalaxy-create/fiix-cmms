import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import http from 'http';
import { initSocket } from './utils/socket';

dotenv.config();

// Restart trigger

const app = express();
const server = http.createServer(app);

// Inicializar WebSockets
initSocket(server);

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Producción: Express sirve el frontend ya compilado (frontend/dist) en el mismo
// puerto que la API, para no depender de un segundo proceso Vite en :5173.
// Se coloca DESPUÉS de las rutas /api para no interferir con ellas ni con /uploads.
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  console.log('[FIIX] Sirviendo frontend/dist en este mismo puerto (modo producción de un solo proceso).');
} else {
  console.log('[FIIX] frontend/dist no encontrado; solo se sirve la API (usa "cd frontend && npm run dev" para la UI en desarrollo).');
}

// Initialize Cron Jobs
initCronJobs();

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

