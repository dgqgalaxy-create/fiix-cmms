import { Router } from 'express';
import { getWorkOrderTimeline } from '../controllers/woTimelineController';
import {
  getCostCategories,
  createCostCategory,
  updateCostCategory,
  getWorkOrderCosts,
  addWorkOrderCost,
  deleteWorkOrderCost,
} from '../controllers/workOrderCostController';
import {
  getWorkOrderRelations,
  createWorkOrderRelation,
  deleteWorkOrderRelation,
  searchWorkOrdersForRelation,
} from '../controllers/woRelationsController';
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
  markWorkOrderSeen,
} from '../controllers/workOrderController';
import {
  listWorkOrderComments,
  createWorkOrderComment,
  woCommentUpload,
} from '../controllers/woCommentsController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';
import { verifyDevPasswordStrict } from '../middlewares/devPassword';
import { upload } from '../middlewares/upload';

const router = Router();

router.get('/', authenticate, getWorkOrders);

// Categorías de costo (antes de /:id para que no las capture la ruta de detalle).
router.get('/cost-categories', authenticate, getCostCategories);
router.post('/cost-categories', authenticate, requireWritable, requirePermission('EDIT_WORK_ORDERS'), createCostCategory);
router.patch('/cost-categories/:id', authenticate, requireWritable, requirePermission('EDIT_WORK_ORDERS'), updateCostCategory);

// Costos adicionales por orden.
router.get('/:id/costs', authenticate, getWorkOrderCosts);
router.post('/:id/costs', authenticate, requireWritable, requirePermission('EDIT_WORK_ORDERS'), addWorkOrderCost);
router.delete('/:id/costs/:costId', authenticate, requireWritable, requirePermission('EDIT_WORK_ORDERS'), deleteWorkOrderCost);

router.get('/requesters', authenticate, getRequesters);
router.get('/mine-open-count', authenticate, getMineOpenCount);

router.get('/summary', authenticate, getWorkOrdersSummary);
router.get('/line-stoppage', authenticate, getLineStoppageStatus);
router.post('/:id/seen', authenticate, markWorkOrderSeen);
router.get('/:id/timeline', authenticate, getWorkOrderTimeline);
router.get('/:id/relations', authenticate, getWorkOrderRelations);
router.get('/:id/relations/search', authenticate, searchWorkOrdersForRelation);
router.post('/:id/relations', authenticate, requireWritable, createWorkOrderRelation);
router.delete('/:id/relations/:relationId', authenticate, requireWritable, deleteWorkOrderRelation);
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
router.delete(
  '/:id',
  authenticate,
  requireWritable,
  requirePermission('DELETE_WORK_ORDERS'),
  verifyDevPasswordStrict,
  deleteWorkOrder
);
router.post('/:id/join', authenticate, requireWritable, requirePermission('EDIT_WORK_ORDERS'), joinWorkOrder);

export default router;
