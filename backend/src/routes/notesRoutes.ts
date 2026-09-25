import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { requireWritable } from '../middlewares/authMiddleware';
import {
  listPersonalNotes,
  createPersonalNote,
  updatePersonalNote,
  deletePersonalNote,
  listOperationalTasks,
  createOperationalTask,
  updateOperationalTask,
  deleteOperationalTask,
  snoozeOperationalTask,
  notesSummary,
} from '../controllers/notesController';
import {
  listAnnouncements,
  createAnnouncement,
  markAnnouncementSeen,
  deleteAnnouncement,
  announcementUpload,
} from '../controllers/announcementsController';

const router = Router();

router.use(authenticate);

router.get('/summary', notesSummary);

router.get('/personal', listPersonalNotes);
router.post('/personal', requireWritable, createPersonalNote);
router.put('/personal/:id', requireWritable, updatePersonalNote);
router.delete('/personal/:id', requireWritable, deletePersonalNote);

router.get('/tasks', listOperationalTasks);
router.post('/tasks', requireWritable, createOperationalTask);
router.put('/tasks/:id', requireWritable, updateOperationalTask);
router.post('/tasks/:id/snooze', requireWritable, snoozeOperationalTask);
router.delete('/tasks/:id', requireWritable, deleteOperationalTask);

router.get('/announcements', listAnnouncements);
router.post(
  '/announcements',
  requireWritable,
  announcementUpload.fields([{ name: 'image', maxCount: 1 }]),
  createAnnouncement
);
router.post('/announcements/:id/seen', markAnnouncementSeen);
router.delete('/announcements/:id', requireWritable, deleteAnnouncement);

export default router;
