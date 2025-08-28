import { Request, Response, NextFunction } from 'express';
import User from '../models/users';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
  };
  voiceUsage?: {
    currentCount: number;
    limit: number;
  };
}

export const voiceUsageLimiter = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only apply voice usage limits to customer and buyer roles
    if (user.role !== 'customer' && user.role !== 'buyer') {
      next();
      return;
    }

    const userDoc = await User.findById(user.userId);
    if (!userDoc) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if we need to reset daily limit
    const now = new Date();
    const lastReset = new Date(userDoc.lastVoiceUsageReset!);
    const isNewDay = now.toDateString() !== lastReset.toDateString();

    if (isNewDay) {
      userDoc.voiceUsageCount = 0;
      userDoc.lastVoiceUsageReset = now;
      await userDoc.save();
    }

    // Check current usage against limit
    if (userDoc.voiceUsageCount! >= userDoc.voiceUsageLimit!) {
      const resetTime = new Date(userDoc.lastVoiceUsageReset!);
      resetTime.setDate(resetTime.getDate() + 1); // Next reset time

      res.status(429).json({
        error: 'Voice usage limit exceeded',
        limit: userDoc.voiceUsageLimit,
        currentUsage: userDoc.voiceUsageCount,
        resetTime: resetTime.toISOString(),
        message: `You've used all ${userDoc.voiceUsageLimit} voice transcriptions for today. Limit resets in ${Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60 * 60))} hours.`
      });
      return;
    }

    // Add usage info to request for later use
    req.voiceUsage = {
      currentCount: userDoc.voiceUsageCount!,
      limit: userDoc.voiceUsageLimit!
    };

    next();
  } catch (error) {
    console.error('Voice usage limiter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
