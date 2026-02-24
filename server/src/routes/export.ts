import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import {
  exportPpt,
  exportPptValidation,
  exportVideo,
} from '../controllers/exportController';

const router = Router();

router.use(authenticate);
router.use(generalLimiter);

// POST /api/export/ppt
router.post('/ppt', exportPptValidation, exportPpt);

// POST /api/export/video
router.post('/video', exportVideo);

export default router;
