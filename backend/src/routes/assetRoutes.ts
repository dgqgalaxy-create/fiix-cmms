import { Router } from 'express';
import { getAssets, getAssetById, createAsset, updateAsset, deleteAsset } from '../controllers/assetController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Todos pueden leer (Admin, Gestionador, Tecnico)
router.get('/', getAssets);
router.get('/:id', getAssetById);

// Solo Admin y Gestionador pueden crear, editar y eliminar
const writeRoles = ['ADMINISTRADOR', 'GESTIONADOR'];

router.post('/', requireRole(writeRoles), createAsset);
router.patch('/:id', requireRole(writeRoles), updateAsset);
router.delete('/:id', requireRole(writeRoles), deleteAsset);

export default router;
