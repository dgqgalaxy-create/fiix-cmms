import { weeklyReport, weeklyFreeze, weeklyCut } from '../controllers/weeklyWorkOrderController';
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
  getMineOpenCount,
} from '../controllers/workOrderController';
import {
  listWorkOrderComments,
  createWorkOrderComment,
  woCommentUpload,
} from '../controllers/woCommentsController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/upload';

const router = Router();

router.get('/', authenticate, getWorkOrders);

router.get('/requesters', authenticate, getRequesters);
router.get('/mine-open-count', authenticate, getMineOpenCount);

router.get('/summary', authenticate, getWorkOrdersSummary);
router.get('/line-stoppage', authenticate, getLineStoppageStatus);
router.get('/weekly', authenticate, requirePermission('VIEW_ALL_WORK_ORDERS'), weeklyReport);
router.post('/weekly/plan', authenticate, requireWritable, requirePermission('VIEW_ALL_WORK_ORDERS'), requirePermission('MANAGE_CALENDAR'), weeklyFreeze);
router.post('/weekly/cuts', authenticate, requireWritable, requirePermission('VIEW_ALL_WORK_ORDERS'), requirePermission('EDIT_WORK_ORDERS'), weeklyCut);
router.get('/:id/comments', authenticate, listWorkOrderComments);
router.post(
  '/:id/comments',
  authenticate,
  requireWritable,
  woCommentUpload.fields([{ name: 'attachment', maxCount: 1 }]),
  createWorkOrderComment
);
router.get('/:id', authenticate, getWorkOrderById);
router.post(
  '/', 
  authenticate,
  requireWritable,
  requirePermission('CREATE_WORK_ORDERS'), 
  upload.fields([{ name: 'request_image', maxCount: 1 }]), 
  createWorkOrder
);
router.patch(
  '/:id', 
  authenticate,
  requireWritable,
  requirePermission('EDIT_WORK_ORDERS'),
  upload.fields([{ name: 'before_image', maxCount: 1 }, { name: 'after_image', maxCount: 1 }]), 
  updateWorkOrder
);
router.delete('/:id', authenticate, requireWritable, requirePermission('DELETE_WORK_ORDERS'), deleteWorkOrder);
router.post('/:id/join', authenticate, requireWritable, requirePermission('EDIT_WORK_ORDERS'), joinWorkOrder);

export default router;
