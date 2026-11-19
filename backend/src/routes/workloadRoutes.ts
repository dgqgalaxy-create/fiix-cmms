import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { getWorkload } from '../controllers/workloadController';

const router = Router();

router.use(authenticate);

/** Lectura: cualquier usuario autenticado (es información agregada del equipo). */
router.get('/', getWorkload);

export default router;
