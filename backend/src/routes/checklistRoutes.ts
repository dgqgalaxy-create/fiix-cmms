import { Router } from 'express';
import { 
  getTodayChecklist, 
  createTodayChecklist,
  startChecklist,
  transferChecklist,
  acceptChecklistTransfer,
  rejectChecklistTransfer,
  cancelChecklistTransfer,
  assignChecklistTechnician,
  requestChecklistContinuation,
  approveChecklistContinuation,
  rejectChecklistContinuation,
  cancelChecklistContinuation,
  updateChecklistRow, 
  submitChecklist, 
  reviewChecklist, 
  getChecklistHistory,
  getChecklistById,
  getChecklistConfig,
  updateChecklistConfig,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  reorderActivities,
  restoreDefaultActivities
} from '../controllers/checklistController';
import { authenticate, requirePermission, requireRole, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Catálogo de Actividades
router.get('/config', getChecklistConfig);
router.put('/config', requireWritable, requirePermission('MANAGE_CHECKLIST_CATALOG'), updateChecklistConfig);
router.get('/activities', getActivities);
router.post('/activities', requireWritable, requirePermission('MANAGE_CHECKLIST_CATALOG'), createActivity);
router.post('/activities/restore-defaults', requireWritable, requirePermission('MANAGE_CHECKLIST_CATALOG'), restoreDefaultActivities);
router.put('/activities/reorder', requireWritable, requirePermission('MANAGE_CHECKLIST_CATALOG'), reorderActivities);
router.put('/activities/:id', requireWritable, requirePermission('MANAGE_CHECKLIST_CATALOG'), updateActivity);
router.delete('/activities/:id', requireWritable, requirePermission('MANAGE_CHECKLIST_CATALOG'), deleteActivity);

// Operaciones Diarias
router.get('/today', getTodayChecklist);
router.post('/today', requireWritable, createTodayChecklist);
router.get('/history', getChecklistHistory);

// Traspasos (antes de /:id para no capturar "transfers" como id)
router.post('/transfers/:id/accept', requireWritable, acceptChecklistTransfer);
router.post('/transfers/:id/reject', requireWritable, rejectChecklistTransfer);
router.post('/transfers/:id/cancel', requireWritable, cancelChecklistTransfer);

// Continuación tras incumplimiento
router.post('/continuation-requests/:id/approve', requireWritable, requireRole(['ADMINISTRADOR']), approveChecklistContinuation);
router.post('/continuation-requests/:id/reject', requireWritable, requireRole(['ADMINISTRADOR']), rejectChecklistContinuation);
router.post('/continuation-requests/:id/cancel', requireWritable, cancelChecklistContinuation);

router.post('/:id/start', requireWritable, startChecklist);
router.post('/:id/transfer', requireWritable, transferChecklist);
router.post('/:id/assign-technician', requireWritable, requireRole(['ADMINISTRADOR']), assignChecklistTechnician);
router.post('/:id/request-continuation', requireWritable, requestChecklistContinuation);
router.get('/:id', getChecklistById);
router.put('/row/:rowId', requireWritable, updateChecklistRow);
router.post('/:id/submit', requireWritable, submitChecklist);

router.post('/:id/review', requireWritable, requirePermission('APPROVE_CHECKLIST'), reviewChecklist);

export default router;
