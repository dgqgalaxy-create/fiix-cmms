import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Restart trigger

const app = express();
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
import { initCronJobs } from './utils/cronJobs';

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'CMMS API is running' });
});

// Import and use routes here
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/rca', rcaRoutes);
app.use('/api/dev', devRoutes);

// Initialize Cron Jobs
initCronJobs();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
