import { Router } from 'express';
import {
  getRequesters,
  createRequester,
  updateRequester,
  deleteRequester,
  migrateRequesters
} from '../controllers/requesterController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Endpoint de migración, solo Admins/Gestionadores
router.post('/migrate', authenticate, requirePermission('MANAGE_REQUESTERS'), migrateRequesters);

// Rutas CRUD
router.get('/', authenticate, getRequesters);
router.post('/', authenticate, requirePermission('MANAGE_REQUESTERS'), createRequester);
router.put('/:id', authenticate, requirePermission('MANAGE_REQUESTERS'), updateRequester);
router.delete('/:id', authenticate, requirePermission('MANAGE_REQUESTERS'), deleteRequester);

export default router;
