import { Router } from 'express';
import {
  getWorkOrders,
  getWorkOrdersSummary,
  getWorkOrderById,
  getLineStoppageStatus,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  joinWorkOrder,
  getRequesters,
} from '../controllers/workOrderController';
import {
  listWorkOrderComments,
  createWorkOrderComment,
  woCommentUpload,
} from '../controllers/woCommentsController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';

const router = Router();

router.get('/', authenticate, getWorkOrders);

router.get('/requesters', authenticate, getRequesters);

router.get('/summary', authenticate, getWorkOrdersSummary);
router.get('/line-stoppage', authenticate, getLineStoppageStatus);
router.get('/:id/comments', authenticate, listWorkOrderComments);
router.post(
  '/:id/comments',
  authenticate,
  woCommentUpload.fields([{ name: 'attachment', maxCount: 1 }]),
  createWorkOrderComment
);
router.get('/:id', authenticate, getWorkOrderById);
router.post(
  '/', 
  authenticate, 
  requirePermission('CREATE_WORK_ORDERS'), 
  upload.fields([{ name: 'request_image', maxCount: 1 }]), 
  createWorkOrder
);
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
