import { Router } from 'express';
import {
  getCrews,
  createCrew,
  updateCrew,
  deleteCrew,
  getCrewWorkOrders,
  assignCrewToWorkOrder,
} from '../controllers/crewController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getCrews);

// Gestión de cuadrillas: quien administra personal.
router.post('/', requireWritable, requirePermission('MANAGE_USERS'), createCrew);
router.put('/:id', requireWritable, requirePermission('MANAGE_USERS'), updateCrew);
router.delete('/:id', requireWritable, requirePermission('MANAGE_USERS'), deleteCrew);

router.get('/:id/work-orders', getCrewWorkOrders);

// Asignar a una orden: quien puede editar órdenes.
router.put('/assign/:workOrderId', requireWritable, requirePermission('EDIT_WORK_ORDERS'), assignCrewToWorkOrder);

export default router;
