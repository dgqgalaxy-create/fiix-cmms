import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { verifyDevPasswordStrict } from '../middlewares/devPassword';
import { getSettings, saveSettings, resetSettings, getTeam, previewTeam } from '../controllers/performanceController';

const router = Router();

/** Lectura: cualquier usuario autenticado (el tablero se muestra a gestores y admin). */
router.get('/settings', authenticate, getSettings);
router.get('/team', authenticate, getTeam);
router.post('/team/preview', authenticate, previewTeam);

/** Escritura: Administrador + contraseña de desarrollador. */
router.put('/settings', authenticate, verifyDevPasswordStrict, saveSettings);
router.post('/settings/reset', authenticate, verifyDevPasswordStrict, resetSettings);

export default router;
