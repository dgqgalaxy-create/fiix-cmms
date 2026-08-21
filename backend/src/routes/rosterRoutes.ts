import { Router } from 'express';
import multer from 'multer';
import { getRoster, assignPattern, addException, removeException, importRosterCalendar } from '../controllers/rosterController';
import { authenticate, requirePermission, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

/** Sube el .xlsx del calendario de turnos a memoria (máx. 10 MB, un solo archivo). */
const uploadCalendar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

router.get('/', getRoster);
router.post('/pattern', requireRole(['ADMINISTRADOR']), assignPattern);
router.post('/exception', requirePermission('MANAGE_SHIFTS'), addException);
router.post(
  '/import',
  requireRole(['ADMINISTRADOR']),
  uploadCalendar.single('file'),
  importRosterCalendar
);
router.delete('/exception/:id', requirePermission('MANAGE_SHIFTS'), removeException);

export default router;
