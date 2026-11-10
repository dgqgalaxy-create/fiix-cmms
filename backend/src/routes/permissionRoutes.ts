import { Router } from 'express';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';
import { getAllPermissions, getMyPermissions, updateRolePermissions } from '../controllers/permissionController';

const router = Router();

// Todos los autenticados pueden ver sus propios permisos
router.get('/my-permissions', authenticate, getMyPermissions);

// Solo el administrador puede gestionar todos los permisos
router.get('/', authenticate, requirePermission('MANAGE_ROLES'), getAllPermissions);
router.put('/:role', authenticate, requirePermission('MANAGE_ROLES'), updateRolePermissions);

export default router;
