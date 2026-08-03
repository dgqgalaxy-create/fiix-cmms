import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder, createDraftsFromLowStock, updatePurchaseOrderStatus, updatePurchaseOrderLineCosts } from '../controllers/purchaseOrderController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getPurchaseOrders);
router.post('/', requirePermission('MANAGE_PURCHASES'), createPurchaseOrder);
router.post('/draft-from-low-stock', requirePermission('MANAGE_PURCHASES'), createDraftsFromLowStock);
router.patch('/:id/line-costs', requirePermission('MANAGE_PURCHASES'), updatePurchaseOrderLineCosts);
router.patch('/:id/status', updatePurchaseOrderStatus);

export default router;
