import { Router } from 'express';
import { getAssets, getAssetById, createAsset, updateAsset, deleteAsset } from '../controllers/assetController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Todos pueden leer (Admin, Gestionador, Tecnico)
router.get('/', getAssets);
router.get('/:id', getAssetById);

// Solo los que tienen permiso MANAGE_ASSETS pueden crear, editar y eliminar
router.post('/', requirePermission('MANAGE_ASSETS'), createAsset);
router.patch('/:id', requirePermission('MANAGE_ASSETS'), updateAsset);
router.delete('/:id', requirePermission('MANAGE_ASSETS'), deleteAsset);

export default router;
