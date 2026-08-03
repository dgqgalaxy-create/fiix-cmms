import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  listPersonalNotes,
  createPersonalNote,
  updatePersonalNote,
  deletePersonalNote,
  snoozePersonalNote,
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
router.post('/personal', createPersonalNote);
router.put('/personal/:id', updatePersonalNote);
router.post('/personal/:id/snooze', snoozePersonalNote);
router.delete('/personal/:id', deletePersonalNote);

router.get('/tasks', listOperationalTasks);
router.post('/tasks', createOperationalTask);
router.put('/tasks/:id', updateOperationalTask);
router.post('/tasks/:id/snooze', snoozeOperationalTask);
router.delete('/tasks/:id', deleteOperationalTask);

router.get('/announcements', listAnnouncements);
router.post(
  '/announcements',
  announcementUpload.fields([{ name: 'image', maxCount: 1 }]),
  createAnnouncement
);
router.post('/announcements/:id/seen', markAnnouncementSeen);
router.delete('/announcements/:id', deleteAnnouncement);

export default router;
