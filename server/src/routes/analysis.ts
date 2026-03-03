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
// Note: CSRF protection should be implemented at the app level (e.g., csurf middleware)
// or via SameSite cookie attributes + custom headers for API requests
router.post('/:id', analyzeDocumentValidation, analyzeDocument);

export default router;
