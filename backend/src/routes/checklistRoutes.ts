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
import { authenticate, requirePermission, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Catálogo de Actividades
router.get('/config', getChecklistConfig);
router.put('/config', requirePermission('MANAGE_CHECKLIST_CATALOG'), updateChecklistConfig);
router.get('/activities', getActivities);
router.post('/activities', requirePermission('MANAGE_CHECKLIST_CATALOG'), createActivity);
router.post('/activities/restore-defaults', requirePermission('MANAGE_CHECKLIST_CATALOG'), restoreDefaultActivities);
router.put('/activities/reorder', requirePermission('MANAGE_CHECKLIST_CATALOG'), reorderActivities);
router.put('/activities/:id', requirePermission('MANAGE_CHECKLIST_CATALOG'), updateActivity);
router.delete('/activities/:id', requirePermission('MANAGE_CHECKLIST_CATALOG'), deleteActivity);

// Operaciones Diarias
router.get('/today', getTodayChecklist);
router.post('/today', createTodayChecklist);
router.get('/history', getChecklistHistory);

// Traspasos (antes de /:id para no capturar "transfers" como id)
router.post('/transfers/:id/accept', acceptChecklistTransfer);
router.post('/transfers/:id/reject', rejectChecklistTransfer);
router.post('/transfers/:id/cancel', cancelChecklistTransfer);

// Continuación tras incumplimiento
router.post('/continuation-requests/:id/approve', requireRole(['ADMINISTRADOR']), approveChecklistContinuation);
router.post('/continuation-requests/:id/reject', requireRole(['ADMINISTRADOR']), rejectChecklistContinuation);
router.post('/continuation-requests/:id/cancel', cancelChecklistContinuation);

router.post('/:id/start', startChecklist);
router.post('/:id/transfer', transferChecklist);
router.post('/:id/assign-technician', requireRole(['ADMINISTRADOR']), assignChecklistTechnician);
router.post('/:id/request-continuation', requestChecklistContinuation);
router.get('/:id', getChecklistById);
router.put('/row/:rowId', updateChecklistRow);
router.post('/:id/submit', submitChecklist);

router.post('/:id/review', requirePermission('APPROVE_CHECKLIST'), reviewChecklist);

export default router;
