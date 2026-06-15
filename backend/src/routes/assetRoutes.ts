import { Router } from 'express';
import { getAssets, getAssetById, createAsset, updateAsset, deleteAsset } from '../controllers/assetController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads/assets');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.use(authenticate);

// Todos pueden leer (Admin, Gestionador, Tecnico)
router.get('/', getAssets);
router.get('/:id', getAssetById);

// Solo los que tienen permiso MANAGE_ASSETS pueden crear, editar y eliminar
router.post('/', requirePermission('MANAGE_ASSETS'), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'document', maxCount: 1 }]), createAsset);
router.patch('/:id', requirePermission('MANAGE_ASSETS'), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'document', maxCount: 1 }]), updateAsset);
router.delete('/:id', requirePermission('MANAGE_ASSETS'), deleteAsset);

export default router;
