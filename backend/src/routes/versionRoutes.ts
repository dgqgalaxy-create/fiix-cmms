import { Router } from 'express';
import { getVersionStatus } from '../controllers/versionController';

const router = Router();

/** Público: versión desplegada vs GitHub (para aviso de actualización). */
router.get('/status', getVersionStatus);

export default router;
