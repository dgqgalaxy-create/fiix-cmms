import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, heartbeat, getOnlineUsers, updateMyPreferences, getMe } from '../controllers/userController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Heartbeat for online status
router.post('/heartbeat', authenticate, heartbeat);
router.get('/online', authenticate, getOnlineUsers);

// Update my preferences
router.get('/me', authenticate, getMe);
router.put('/me/preferences', authenticate, updateMyPreferences);

// Only authenticated users can fetch users.
router.get('/', authenticate, getUsers);
router.post('/', authenticate, requirePermission('MANAGE_USERS'), createUser);
router.put('/:id', authenticate, requirePermission('MANAGE_USERS'), updateUser);
router.delete('/:id', authenticate, requirePermission('MANAGE_USERS'), deleteUser);

export default router;
