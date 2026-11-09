import { Router } from 'express';
import { getAging, getConsumption, getReliability, getCosts, getRequests } from '../controllers/statsController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Estadística: solo lectura de datos operativos, igual que KPIs.
router.get('/aging', getAging);
router.get('/consumption', getConsumption);
router.get('/reliability', getReliability);
router.get('/costs', getCosts);
router.get('/requests', getRequests);

export default router;
