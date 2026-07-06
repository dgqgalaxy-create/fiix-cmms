import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Solo los administradores pueden ver y modificar la configuración global
router.get('/', authenticate, requirePermission('MANAGE_PERMISSIONS'), getSettings);
router.patch('/', authenticate, requirePermission('MANAGE_PERMISSIONS'), updateSettings);

export default router;
