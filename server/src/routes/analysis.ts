import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { analysisLimiter } from '../middleware/rateLimiter';
import {
  analyzeDocument,
  analyzeDocumentValidation,
} from '../controllers/analysisController';

const router = Router();

router.use(authenticate);
router.use(analysisLimiter);

// POST /api/analyze/:id
router.post('/:id', analyzeDocumentValidation, analyzeDocument);

export default router;
