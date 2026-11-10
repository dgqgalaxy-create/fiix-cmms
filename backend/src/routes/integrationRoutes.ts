import { Router } from 'express';
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhookHandler,
} from '../controllers/integrationController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);
router.use(requirePermission('MANAGE_SETTINGS'));

router.get('/keys', getApiKeys);
router.post('/keys', requireWritable, createApiKey);
router.delete('/keys/:id', requireWritable, revokeApiKey);

router.get('/webhooks', getWebhooks);
router.post('/webhooks', requireWritable, createWebhook);
router.patch('/webhooks/:id', requireWritable, updateWebhook);
router.delete('/webhooks/:id', requireWritable, deleteWebhook);
router.post('/webhooks/:id/test', requireWritable, testWebhookHandler);

export default router;
