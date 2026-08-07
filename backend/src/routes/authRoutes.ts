import { Router } from 'express';
import { login, changePassword } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { createRateLimiter } from '../middlewares/rateLimit';

const router = Router();

/** Login: 10 intentos / 15 min por IP+email (anti fuerza bruta). */
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de inicio de sesión. Espera 15 minutos o prueba más tarde.',
  keyFn: (req) => String(req.body?.email || '').toLowerCase().trim(),
});

router.post('/login', loginLimiter, login);
router.post('/change-password', authenticate, changePassword);

export default router;
