import { Router } from 'express';
import path from 'path';
import { getDocuments, getDocumentFolders, uploadDocument, deleteDocument } from '../controllers/inventoryController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';
import { createDocumentUploader } from '../middlewares/upload';

const router = Router();

const documentsDir = path.join(__dirname, '../../uploads/documents');
const upload = createDocumentUploader(documentsDir, 1);

router.use(authenticate);

router.get('/', getDocuments);
router.get('/folders', getDocumentFolders);
router.post('/', requireWritable, requirePermission('MANAGE_INVENTORY'), upload.single('file'), uploadDocument);
router.delete('/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), deleteDocument);

export default router;
