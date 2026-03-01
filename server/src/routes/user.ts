import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { deleteAccount, getUsage } from '../controllers/userController';

const router = Router();

router.use(authenticate);

// GET /api/user/usage — get current usage metering stats
router.get('/usage', getUsage);

// DELETE /api/user — delete account and all associated data
router.delete('/', deleteAccount);

export default router;
