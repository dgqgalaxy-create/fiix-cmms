import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  createDraftsFromLowStock,
  updatePurchaseOrderStatus,
  updatePurchaseOrderLineCosts,
  updatePurchaseOrder,
  uploadPurchaseOrderDocument,
  deletePurchaseOrderDocument,
} from '../controllers/purchaseOrderController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads/purchase-orders');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/** PDF o Word (documentos SP/OC SAP). */
const poDocFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ok =
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/msword' ||
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (!ok) {
    cb(new Error('Solo se permiten PDF o Word'));
    return;
  }
  cb(null, true);
};

const uploadPoDoc = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `doc-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: poDocFileFilter,
});

router.use(authenticate);

router.get('/', getPurchaseOrders);
router.post('/', requireWritable, requirePermission('MANAGE_PURCHASES'), createPurchaseOrder);
router.post('/draft-from-low-stock', requireWritable, requirePermission('MANAGE_PURCHASES'), createDraftsFromLowStock);
router.patch('/:id', requireWritable, requirePermission('MANAGE_PURCHASES'), updatePurchaseOrder);
router.patch('/:id/line-costs', requireWritable, requirePermission('MANAGE_PURCHASES'), updatePurchaseOrderLineCosts);
router.patch('/:id/status', requireWritable, updatePurchaseOrderStatus);
router.post(
  '/:id/documents',
  requireWritable,
  requirePermission('MANAGE_PURCHASES'),
  uploadPoDoc.single('file'),
  uploadPurchaseOrderDocument
);
router.delete(
  '/:id/documents/:docId',
  requireWritable,
  requirePermission('MANAGE_PURCHASES'),
  deletePurchaseOrderDocument
);

export default router;
