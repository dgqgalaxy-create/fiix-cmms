import { Router } from 'express';
import { getAssets, getAssetById, getAssetMetrics, createAsset, updateAsset, deleteAsset, getLineCosts, updateLineCostsVisibleZones } from '../controllers/assetController';
import { authenticate, requirePermission, requireRole } from '../middlewares/authMiddleware';
import { createDiskUploader } from '../middlewares/upload';
import path from 'path';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads/assets');
const upload = createDiskUploader(uploadDir, { allowPdf: true, maxFiles: 4 });

router.use(authenticate);

// Todos pueden leer (Admin, Gestionador, Tecnico)
router.get('/', getAssets);
router.get('/line-costs', getLineCosts);
router.put('/line-costs/visible-zones', requireRole(['ADMINISTRADOR']), updateLineCostsVisibleZones);
router.get('/:id', getAssetById);
router.get('/:id/metrics', getAssetMetrics);

// Solo los que tienen permiso MANAGE_ASSETS pueden crear, editar y eliminar
router.post('/', requirePermission('MANAGE_ASSETS'), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'document', maxCount: 1 }]), createAsset);
router.patch('/:id', requirePermission('MANAGE_ASSETS'), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'document', maxCount: 1 }]), updateAsset);
router.delete('/:id', requirePermission('MANAGE_ASSETS'), deleteAsset);

export default router;
