import { Router } from 'express';
import {
  getRequesters,
  createRequester,
  updateRequester,
  deleteRequester,
  migrateRequesters
} from '../controllers/requesterController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint de migración, solo Admins/Gestionadores
router.post('/migrate', authenticate, requireRole(['ADMINISTRADOR', 'GESTIONADOR']), migrateRequesters);

// Rutas CRUD
router.get('/', authenticate, getRequesters);
router.post('/', authenticate, requireRole(['ADMINISTRADOR', 'GESTIONADOR']), createRequester);
router.put('/:id', authenticate, requireRole(['ADMINISTRADOR', 'GESTIONADOR']), updateRequester);
router.delete('/:id', authenticate, requireRole(['ADMINISTRADOR', 'GESTIONADOR']), deleteRequester);

export default router;
