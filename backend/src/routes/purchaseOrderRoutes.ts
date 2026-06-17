import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus } from '../controllers/purchaseOrderController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getPurchaseOrders);
router.post('/', createPurchaseOrder);
router.patch('/:id/status', updatePurchaseOrderStatus);

export default router;
