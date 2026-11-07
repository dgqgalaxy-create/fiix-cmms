import { Router } from 'express';
import {
  getDowntimes,
  createDowntime,
  closeDowntime,
  updateDowntime,
  deleteDowntime,
  getDowntimeStats,
} from '../controllers/downtimeController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Cualquier usuario autenticado puede reportar y cerrar un paro: en piso el
// técnico es quien ve la máquina detenida.
router.get('/stats', getDowntimeStats);
router.get('/', getDowntimes);
router.post('/', requireWritable, createDowntime);
router.patch('/:id', requireWritable, updateDowntime);
router.patch('/:id/close', requireWritable, closeDowntime);
router.delete('/:id', requireWritable, requirePermission('MANAGE_ASSETS'), deleteDowntime);

export default router;
