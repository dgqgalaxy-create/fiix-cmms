import { Router } from 'express';
import {
  getRcaTree,
  getProblems,
  createProblem,
  updateProblem,
  getCauses,
  createCause,
  updateCause,
  getRemedies,
  createRemedy,
  updateRemedy
} from '../controllers/rcaController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/tree', getRcaTree);

router.get('/problems', requirePermission('VIEW_RCA'), getProblems);
router.post('/problems', requirePermission('MANAGE_RCA'), createProblem);
router.put('/problems/:id', requirePermission('MANAGE_RCA'), updateProblem);

router.get('/problems/:problemId/causes', requirePermission('VIEW_RCA'), getCauses);
router.post('/causes', requirePermission('MANAGE_RCA'), createCause);
router.put('/causes/:id', requirePermission('MANAGE_RCA'), updateCause);

router.get('/causes/:causeId/remedies', requirePermission('VIEW_RCA'), getRemedies);
router.post('/remedies', requirePermission('MANAGE_RCA'), createRemedy);
router.put('/remedies/:id', requirePermission('MANAGE_RCA'), updateRemedy);

export default router;
