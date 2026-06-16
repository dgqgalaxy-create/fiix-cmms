import { Router } from 'express';
import { 
  getMaintenancePlans, 
  createMaintenancePlan, 
  updateMaintenancePlan, 
  deleteMaintenancePlan 
} from '../controllers/maintenanceController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Permiso: MANAGE_MAINTENANCE_PLANS.
router.get('/plans', getMaintenancePlans);
router.post('/plans', requirePermission('MANAGE_MAINTENANCE_PLANS'), createMaintenancePlan);
router.patch('/plans/:id', requirePermission('MANAGE_MAINTENANCE_PLANS'), updateMaintenancePlan);
router.delete('/plans/:id', requirePermission('MANAGE_MAINTENANCE_PLANS'), deleteMaintenancePlan);

export default router;
