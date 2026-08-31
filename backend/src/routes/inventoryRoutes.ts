import { Router } from 'express';
import { 
  getCategories, createCategory, updateCategory, deleteCategory,
  getLocations, createLocation, updateLocation, deleteLocation,
  getVendors, createVendor, updateVendor, deleteVendor,
  getItems, getItemById, createItem, updateItem, deleteItem,
  getTransactions, createTransaction, getTransactionsSummary,
  getInventorySummary,
  searchImages, proxyImage
} from '../controllers/inventoryController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';
import { createDiskUploader } from '../middlewares/upload';
import path from 'path';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads/inventory');
const upload = createDiskUploader(uploadDir, { maxFiles: 2 });
const vendorsUploadDir = path.join(__dirname, '../../uploads/vendors');
const vendorsUpload = createDiskUploader(vendorsUploadDir, { maxFiles: 1 });

router.use(authenticate);

// ==========================================
// RUTAS DE CATALOGOS Y RESUMEN
// ==========================================
// Summary
router.get('/summary', getInventorySummary);

// Image Search
router.get('/images/search', requirePermission('MANAGE_INVENTORY'), searchImages);
router.get('/images/proxy', requirePermission('MANAGE_INVENTORY'), proxyImage);

router.get('/categories', getCategories);
router.post('/categories', requireWritable, requirePermission('MANAGE_INVENTORY'), createCategory);
router.patch('/categories/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), updateCategory);
router.delete('/categories/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), deleteCategory);

router.get('/locations', getLocations);
router.post('/locations', requireWritable, requirePermission('MANAGE_INVENTORY'), createLocation);
router.patch('/locations/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), updateLocation);
router.delete('/locations/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), deleteLocation);

router.get('/vendors', getVendors);
router.post('/vendors', requireWritable, requirePermission('MANAGE_INVENTORY'), vendorsUpload.fields([{ name: 'logo', maxCount: 1 }]), createVendor);
router.patch('/vendors/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), vendorsUpload.fields([{ name: 'logo', maxCount: 1 }]), updateVendor);
router.delete('/vendors/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), deleteVendor);

// ==========================================
// RUTAS DE REPUESTOS (ITEMS)
// ==========================================
router.get('/items', getItems);
router.get('/items/:id', getItemById);
router.post('/items', requireWritable, requirePermission('MANAGE_INVENTORY'), upload.fields([{ name: 'image', maxCount: 1 }]), createItem);
router.patch('/items/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), upload.fields([{ name: 'image', maxCount: 1 }]), updateItem);
router.delete('/items/:id', requireWritable, requirePermission('DELETE_ITEMS'), deleteItem);

// ==========================================
// RUTAS DE TRANSACCIONES E HISTORIAL
// ==========================================
router.get('/transactions', getTransactions);
router.get('/transactions/summary', getTransactionsSummary);
// Los técnicos también pueden registrar salidas al usar repuestos
router.post('/transactions', requireWritable, createTransaction);

export default router;
