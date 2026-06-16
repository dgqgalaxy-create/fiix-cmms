import { Router } from 'express';
import { 
  getCategories, createCategory, updateCategory, deleteCategory,
  getLocations, createLocation, updateLocation, deleteLocation,
  getVendors, createVendor, updateVendor, deleteVendor,
  getItems, createItem, updateItem,
  getTransactions, createTransaction,
  getInventorySummary,
  searchImages, proxyImage
} from '../controllers/inventoryController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads/inventory');
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

// ==========================================
// RUTAS DE CATALOGOS Y RESUMEN
// ==========================================
// Summary
router.get('/summary', authenticate, getInventorySummary);

// Image Search
router.get('/images/search', authenticate, requirePermission('MANAGE_INVENTORY'), searchImages);
router.get('/images/proxy', authenticate, requirePermission('MANAGE_INVENTORY'), proxyImage);

router.get('/categories', getCategories);
router.post('/categories', requirePermission('MANAGE_INVENTORY'), createCategory);
router.patch('/categories/:id', requirePermission('MANAGE_INVENTORY'), updateCategory);
router.delete('/categories/:id', requirePermission('MANAGE_INVENTORY'), deleteCategory);

router.get('/locations', getLocations);
router.post('/locations', requirePermission('MANAGE_INVENTORY'), createLocation);
router.patch('/locations/:id', requirePermission('MANAGE_INVENTORY'), updateLocation);
router.delete('/locations/:id', requirePermission('MANAGE_INVENTORY'), deleteLocation);

router.get('/vendors', getVendors);
router.post('/vendors', requirePermission('MANAGE_INVENTORY'), createVendor);
router.patch('/vendors/:id', requirePermission('MANAGE_INVENTORY'), updateVendor);
router.delete('/vendors/:id', requirePermission('MANAGE_INVENTORY'), deleteVendor);

// ==========================================
// RUTAS DE REPUESTOS (ITEMS)
// ==========================================
router.get('/items', getItems);
router.post('/items', requirePermission('MANAGE_INVENTORY'), upload.fields([{ name: 'image', maxCount: 1 }]), createItem);
router.patch('/items/:id', requirePermission('MANAGE_INVENTORY'), upload.fields([{ name: 'image', maxCount: 1 }]), updateItem);

// ==========================================
// RUTAS DE TRANSACCIONES E HISTORIAL
// ==========================================
router.get('/transactions', getTransactions);
// Los técnicos también pueden registrar salidas al usar repuestos
router.post('/transactions', createTransaction);

export default router;
