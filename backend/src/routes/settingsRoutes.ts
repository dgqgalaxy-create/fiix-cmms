import { Router } from 'express';
import { getSettings, updateSettings, getUoms, createUom, deleteUom } from '../controllers/settingsController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Solo los administradores pueden ver y modificar la configuración global
router.get('/', authenticate, requirePermission('VIEW_SETTINGS'), getSettings);
router.patch('/', authenticate, requirePermission('VIEW_SETTINGS'), updateSettings);

// UOM (Unidades de medida)
router.get('/uom', authenticate, getUoms);
router.post('/uom', authenticate, requirePermission('MANAGE_PERMISSIONS'), createUom);
router.delete('/uom/:id', authenticate, requirePermission('MANAGE_PERMISSIONS'), deleteUom);

export default router;
