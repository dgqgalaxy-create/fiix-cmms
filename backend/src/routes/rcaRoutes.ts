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
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/tree', getRcaTree);

router.get('/problems', getProblems);
router.post('/problems', requireRole(['ADMINISTRADOR', 'GESTIONADOR']), createProblem);
router.put('/problems/:id', requireRole(['ADMINISTRADOR', 'GESTIONADOR']), updateProblem);

router.get('/problems/:problemId/causes', getCauses);
router.post('/causes', requireRole(['ADMINISTRADOR', 'GESTIONADOR']), createCause);
router.put('/causes/:id', requireRole(['ADMINISTRADOR', 'GESTIONADOR']), updateCause);

router.get('/causes/:causeId/remedies', getRemedies);
router.post('/remedies', requireRole(['ADMINISTRADOR', 'GESTIONADOR']), createRemedy);
router.put('/remedies/:id', requireRole(['ADMINISTRADOR', 'GESTIONADOR']), updateRemedy);

export default router;
