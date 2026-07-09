import { Router } from 'express';
import { 
  getTodayChecklist, 
  createTodayChecklist, 
  updateChecklistRow, 
  submitChecklist, 
  reviewChecklist, 
  getChecklistHistory,
  getChecklistById,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  reorderActivities,
  restoreDefaultActivities
} from '../controllers/checklistController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Catálogo de Actividades
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
router.get('/:id', getChecklistById);
router.put('/row/:rowId', updateChecklistRow);
router.post('/:id/submit', submitChecklist);

router.post('/:id/review', requirePermission('APPROVE_CHECKLIST'), reviewChecklist);

export default router;
