import { Router } from 'express';
import { getRoles, createRole, updateRole, deleteRole } from '../controllers/roleController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMINISTRADOR']));

router.get('/', getRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;
