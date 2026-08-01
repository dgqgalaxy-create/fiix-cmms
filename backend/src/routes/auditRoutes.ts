import { Router, Response, NextFunction } from 'express';
import { authenticate, type AuthRequest } from '../middlewares/authMiddleware';
import { listAuditLogs, exportAuditLogs } from '../controllers/auditController';

const router = Router();

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'ADMINISTRADOR') {
    res.status(403).json({ error: 'Solo administradores pueden ver la bitácora' });
    return;
  }
  next();
};

router.get('/', authenticate, requireAdmin, listAuditLogs);
router.get('/export', authenticate, requireAdmin, exportAuditLogs);

export default router;
