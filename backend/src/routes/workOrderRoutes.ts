import { Router } from 'express';
import { getWorkOrders, getWorkOrderById, createWorkOrder, updateWorkOrder } from '../controllers/workOrderController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';

const router = Router();

router.get('/', authenticate, getWorkOrders);

const writeRoles = ['ADMINISTRADOR', 'GESTIONADOR'];
router.get('/:id', authenticate, getWorkOrderById);
router.post('/', authenticate, requireRole(writeRoles), createWorkOrder);
router.patch(
  '/:id', 
  authenticate, 
  upload.fields([{ name: 'before_image', maxCount: 1 }, { name: 'after_image', maxCount: 1 }]), 
  updateWorkOrder
);

export default router;
