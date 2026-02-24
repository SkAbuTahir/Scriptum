import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { analysisLimiter } from '../middleware/rateLimiter';
import {
  generateAudio,
  generateAudioValidation,
  getAudioSegments,
  getAudioSegmentsValidation,
} from '../controllers/audioController';

const router = Router();

router.use(authenticate);

// POST /api/generate-audio
router.post('/', analysisLimiter, generateAudioValidation, generateAudio);

// GET /api/generate-audio/:documentId
router.get('/:documentId', getAudioSegmentsValidation, getAudioSegments);

export default router;
