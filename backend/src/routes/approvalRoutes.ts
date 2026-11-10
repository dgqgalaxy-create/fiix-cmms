import { Router } from 'express';
import {
  getApprovalRules,
  createApprovalRule,
  updateApprovalRule,
  deleteApprovalRule,
  getPendingApprovals,
  approveWorkOrder,
  rejectWorkOrder,
  getApprovalHistory,
} from '../controllers/approvalController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Reglas (solo administración de configuración)
router.get('/rules', getApprovalRules);
router.post('/rules', requireWritable, requirePermission('MANAGE_SETTINGS'), createApprovalRule);
router.put('/rules/:id', requireWritable, requirePermission('MANAGE_SETTINGS'), updateApprovalRule);
router.delete('/rules/:id', requireWritable, requirePermission('MANAGE_SETTINGS'), deleteApprovalRule);

// Aprobaciones
router.get('/pending', requirePermission('APPROVE_WORK_ORDERS'), getPendingApprovals);
router.get('/history/:workOrderId', getApprovalHistory);
router.post('/:id/approve', requireWritable, requirePermission('APPROVE_WORK_ORDERS'), approveWorkOrder);
router.post('/:id/reject', requireWritable, requirePermission('APPROVE_WORK_ORDERS'), rejectWorkOrder);

export default router;
