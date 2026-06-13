import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

import authRoutes from './routes/authRoutes';
import assetRoutes from './routes/assetRoutes';
import workOrderRoutes from './routes/workOrderRoutes';

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'CMMS API is running' });
});

// Import and use routes here
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/work-orders', workOrderRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
