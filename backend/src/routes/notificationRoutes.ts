import { Router } from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getVapidKey,
  getPushStatus,
  subscribePush,
  unsubscribePush,
} from '../controllers/notificationController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Público: solo la clave VAPID para PushManager.subscribe
router.get('/vapid-public-key', getVapidKey);

router.use(authenticate);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllAsRead);
// Push routes before /:id/read so "push" is not parsed as an id
router.get('/push/status', getPushStatus);
router.post('/push/subscribe', subscribePush);
router.delete('/push/unsubscribe', unsubscribePush);
router.patch('/:id/read', markAsRead);

export default router;
