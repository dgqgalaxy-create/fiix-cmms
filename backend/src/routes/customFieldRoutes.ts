import { Router } from 'express';
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getCustomFieldValues,
  saveCustomFieldValues,
} from '../controllers/customFieldController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Definiciones: lectura para todos; cambios solo con permiso de configuración.
router.get('/', getCustomFields);
router.post('/', requireWritable, requirePermission('MANAGE_SETTINGS'), createCustomField);
router.put('/:id', requireWritable, requirePermission('MANAGE_SETTINGS'), updateCustomField);
router.delete('/:id', requireWritable, requirePermission('MANAGE_SETTINGS'), deleteCustomField);

// Valores por registro (OT, activo o repuesto).
router.get('/values/:entity/:entityId', getCustomFieldValues);
router.put('/values/:entity/:entityId', requireWritable, saveCustomFieldValues);

export default router;
