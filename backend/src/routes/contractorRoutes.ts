import { Router } from 'express';
import { getContractors, createContractor, updateContractor, deleteContractor } from '../controllers/contractorController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getContractors);
router.post('/', requireWritable, requirePermission('MANAGE_SETTINGS'), createContractor);
router.put('/:id', requireWritable, requirePermission('MANAGE_SETTINGS'), updateContractor);
router.delete('/:id', requireWritable, requirePermission('MANAGE_SETTINGS'), deleteContractor);

export default router;
