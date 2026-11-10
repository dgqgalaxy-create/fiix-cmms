import { Router } from 'express';
import {
  getMeters,
  createMeter,
  updateMeter,
  deleteMeter,
  getMeterReadings,
  addMeterReading,
  deleteMeterReading,
  createMeterTrigger,
  updateMeterTrigger,
  deleteMeterTrigger,
} from '../controllers/meterController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

// Lectura: cualquier usuario autenticado puede consultar medidores y lecturas.
router.get('/', getMeters);
router.get('/:id/readings', getMeterReadings);

// Registro de lecturas: operativo (técnicos y gestionadores incluidos).
// No se exige MANAGE_ASSETS para no frenar la captura diaria de horómetros.
router.post('/:id/readings', addMeterReading);
router.delete('/:id/readings/:readingId', requirePermission('MANAGE_ASSETS'), deleteMeterReading);

// Alta/edición de medidores y disparadores: solo quien administra activos.
router.post('/', requirePermission('MANAGE_ASSETS'), createMeter);
router.patch('/:id', requirePermission('MANAGE_ASSETS'), updateMeter);
router.delete('/:id', requirePermission('MANAGE_ASSETS'), deleteMeter);

// Configurar disparadores: solo el administrador (define cuándo se genera una OT).
router.post('/:id/triggers', requirePermission('MANAGE_METER_TRIGGERS'), createMeterTrigger);
router.patch('/:id/triggers/:triggerId', requirePermission('MANAGE_METER_TRIGGERS'), updateMeterTrigger);
router.delete('/:id/triggers/:triggerId', requirePermission('MANAGE_METER_TRIGGERS'), deleteMeterTrigger);

export default router;
