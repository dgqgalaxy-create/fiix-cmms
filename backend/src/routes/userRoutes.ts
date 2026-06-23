import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, heartbeat, getOnlineUsers } from '../controllers/userController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

// Heartbeat for online status
router.post('/heartbeat', authenticate, heartbeat);
router.get('/online', authenticate, getOnlineUsers);

// Only authenticated users can fetch users.
router.get('/', authenticate, getUsers);
router.post('/', authenticate, requirePermission('MANAGE_USERS'), createUser);
router.put('/:id', authenticate, requirePermission('MANAGE_USERS'), updateUser);
router.delete('/:id', authenticate, requirePermission('MANAGE_USERS'), deleteUser);

export default router;
