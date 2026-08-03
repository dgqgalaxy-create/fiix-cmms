import { Router } from 'express';
import { getSettings, updateSettings, getUoms, createUom, updateUom, deleteUom } from '../controllers/settingsController';
import { authenticate, requirePermission, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Lectura/escritura de ajustes globales del sistema: solo Administrador.
router.get('/', authenticate, requirePermission('VIEW_SETTINGS'), requireRole(['ADMINISTRADOR']), getSettings);
router.patch('/', authenticate, requirePermission('VIEW_SETTINGS'), requireRole(['ADMINISTRADOR']), updateSettings);

// UOM (Unidades de medida)
router.get('/uom', authenticate, getUoms);
router.post('/uom', authenticate, requirePermission('MANAGE_INVENTORY'), createUom);
router.patch('/uom/:id', authenticate, requirePermission('MANAGE_INVENTORY'), updateUom);
router.delete('/uom/:id', authenticate, requirePermission('MANAGE_INVENTORY'), deleteUom);

export default router;
