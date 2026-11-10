import { Router } from 'express';
import { getRoles, createRole, updateRole, deleteRole } from '../controllers/roleController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(requirePermission('MANAGE_ROLES'));

router.get('/', getRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;
