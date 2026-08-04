import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  chatUpload,
  getChatUnreadSummary,
  listConversations,
  createDirectConversation,
  createGroupConversation,
  addGroupParticipants,
  listMessages,
  sendMessage,
  markConversationRead,
} from '../controllers/chatController';

const router = Router();

router.use(authenticate);

router.get('/summary', getChatUnreadSummary);
router.get('/conversations', listConversations);
router.post('/conversations/direct', createDirectConversation);
router.post('/conversations/group', createGroupConversation);
router.post('/conversations/:id/participants', addGroupParticipants);
router.get('/conversations/:id/messages', listMessages);
router.post(
  '/conversations/:id/messages',
  chatUpload.fields([{ name: 'attachment', maxCount: 1 }]),
  sendMessage
);
router.post('/conversations/:id/read', markConversationRead);

export default router;
