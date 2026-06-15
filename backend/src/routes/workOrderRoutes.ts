import { Router } from 'express';
import { getWorkOrders, getWorkOrdersSummary, getWorkOrderById, createWorkOrder, updateWorkOrder, deleteWorkOrder, joinWorkOrder } from '../controllers/workOrderController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';

const router = Router();

router.get('/', authenticate, getWorkOrders);

router.get('/summary', authenticate, getWorkOrdersSummary);
router.get('/:id', authenticate, getWorkOrderById);
router.post('/', authenticate, requirePermission('CREATE_WORK_ORDERS'), createWorkOrder);
router.patch(
  '/:id', 
  authenticate, 
  requirePermission('EDIT_WORK_ORDERS'),
  upload.fields([{ name: 'before_image', maxCount: 1 }, { name: 'after_image', maxCount: 1 }]), 
  updateWorkOrder
);
router.delete('/:id', authenticate, requirePermission('DELETE_WORK_ORDERS'), deleteWorkOrder);
router.post('/:id/join', authenticate, requirePermission('EDIT_WORK_ORDERS'), joinWorkOrder);

export default router;
