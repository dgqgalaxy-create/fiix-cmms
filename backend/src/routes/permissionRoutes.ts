import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authMiddleware';
import { getAllPermissions, getMyPermissions, updateRolePermissions } from '../controllers/permissionController';

const router = Router();

// Todos los autenticados pueden ver sus propios permisos
router.get('/my-permissions', authenticate, getMyPermissions);

// Solo el administrador puede gestionar todos los permisos
router.get('/', authenticate, requireRole(['ADMINISTRADOR']), getAllPermissions);
router.put('/:role', authenticate, requireRole(['ADMINISTRADOR']), updateRolePermissions);

export default router;
