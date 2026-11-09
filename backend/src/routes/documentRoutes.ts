import { Router } from 'express';
import path from 'path';
import { getDocuments, getDocumentFolders, createDocumentFolder, renameDocumentFolder, deleteDocumentFolder, uploadDocument, deleteDocument } from '../controllers/inventoryController';
import { authenticate, requirePermission, requireRole, requireWritable } from '../middlewares/authMiddleware';
import { createDocumentUploader } from '../middlewares/upload';

const router = Router();

const documentsDir = path.join(__dirname, '../../uploads/documents');
const upload = createDocumentUploader(documentsDir, 1);

router.use(authenticate);

router.get('/', getDocuments);
router.get('/folders', getDocumentFolders);
// Carpetas: solo el administrador puede crear, renombrar o eliminar.
router.post('/folders', requireWritable, requireRole(['ADMINISTRADOR']), createDocumentFolder);
router.put('/folders/:id', requireWritable, requireRole(['ADMINISTRADOR']), renameDocumentFolder);
router.delete('/folders/:id', requireWritable, requireRole(['ADMINISTRADOR']), deleteDocumentFolder);
router.post('/', requireWritable, requirePermission('MANAGE_INVENTORY'), upload.single('file'), uploadDocument);
router.delete('/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), deleteDocument);

export default router;
