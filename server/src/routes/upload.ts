import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiter';
import { upload } from '../utils/fileFilter';
import {
  uploadFile,
  uploadYouTube,
  uploadYouTubeValidation,
  uploadWebsite,
  uploadWebsiteValidation,
} from '../controllers/uploadController';

const router = Router();

// All upload routes require authentication
router.use(authenticate);
router.use(uploadLimiter);

// POST /api/upload/file
router.post('/file', upload.single('file'), uploadFile);

// POST /api/upload/youtube
router.post('/youtube', uploadYouTubeValidation, uploadYouTube);

// POST /api/upload/website
router.post('/website', uploadWebsiteValidation, uploadWebsite);

export default router;
