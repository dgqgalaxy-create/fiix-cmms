import { Router } from 'express';
import { getSettings, updateSettings, getFeatures, getDateTimePreferences, getUoms, createUom, updateUom, deleteUom } from '../controllers/settingsController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Lectura/escritura de ajustes globales del sistema: solo Administrador.
router.get('/', authenticate, requirePermission('MANAGE_SETTINGS'), getSettings);
router.patch('/', authenticate, requirePermission('MANAGE_SETTINGS'), updateSettings);

// Características visibles para cualquier usuario autenticado (menú lateral).
router.get('/features', authenticate, getFeatures);
router.get('/preferences', authenticate, getDateTimePreferences);

// UOM (Unidades de medida)
router.get('/uom', authenticate, getUoms);
router.post('/uom', authenticate, requirePermission('MANAGE_INVENTORY'), createUom);
router.patch('/uom/:id', authenticate, requirePermission('MANAGE_INVENTORY'), updateUom);
router.delete('/uom/:id', authenticate, requirePermission('MANAGE_INVENTORY'), deleteUom);

export default router;
