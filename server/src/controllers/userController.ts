import { Response } from 'express';
import User from '../models/User';
import DocumentModel from '../models/Document';
import UsageModel from '../models/Usage';
import { AuthenticatedRequest } from '../types';

// ─── Delete Account ────────────────────────────────────────────────────────────

export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user!.userId;

  try {
    // Delete all user's documents
    const docResult = await DocumentModel.deleteMany({ userId });

    // Delete usage records
    await UsageModel.deleteMany({ userId });

    // Delete the user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully',
      data: {
        documentsDeleted: docResult.deletedCount,
      },
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account. Please try again.',
    });
  }
};

// ─── Get Usage Stats ──────────────────────────────────────────────────────────

export const getUsage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { getUserUsageStats } = await import('../models/Usage');
    const stats = await getUserUsageStats(req.user!.userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('Get usage error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage stats',
    });
  }
};
