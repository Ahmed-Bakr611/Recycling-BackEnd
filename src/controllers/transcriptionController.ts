import { Request, Response } from 'express';
import transcriptionService from '../services/transcriptionService';
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

export const transcribeAudio = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const audioFile = req.file; // Assuming multer is configured

    // Only allow customer and buyer roles to use transcription
    if (user.role !== 'customer' && user.role !== 'buyer') {
      res.status(403).json({ error: 'Voice transcription is only available for customers and buyers' });
      return;
    }

    if (!audioFile) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    // Validate file type and size
    const allowedTypes = ['audio/m4a', 'audio/mp4', 'audio/wav'];
    if (!allowedTypes.includes(audioFile.mimetype)) {
      res.status(400).json({ error: 'Invalid audio file type' });
      return;
    }

    // Check file size (max 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      res.status(400).json({ error: 'Audio file too large (max 25MB)' });
      return;
    }

    // Transcribe the audio
    const transcriptionResult = await transcriptionService.transcribeAudio(
      audioFile.buffer,
      req.body.language || 'ar'
    );

    if (!transcriptionResult.success) {
      res.status(500).json({ 
        error: 'Transcription failed',
        details: transcriptionResult.error 
      });
      return;
    }

    // Increment usage count only for users who have voice usage fields
    const userDoc = await User.findById(user.userId);
    if (userDoc && (userDoc.role === 'customer' || userDoc.role === 'buyer')) {
      userDoc.voiceUsageCount! += 1;
      await userDoc.save();
    }

    res.json({
      success: true,
      transcription: transcriptionResult.transcription,
      usage: userDoc && (userDoc.role === 'customer' || userDoc.role === 'buyer') ? {
        count: userDoc.voiceUsageCount,
        limit: userDoc.voiceUsageLimit,
        remaining: Math.max(0, (userDoc.voiceUsageLimit || 0) - (userDoc.voiceUsageCount || 0))
      } : null
    });

  } catch (error: any) {
    console.error('Transcription controller error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

export const getVoiceUsage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only customer and buyer roles have voice usage
    if (user.role !== 'customer' && user.role !== 'buyer') {
      res.status(403).json({ 
        error: 'Access denied',
        message: 'Voice usage is only available for customers and buyers'
      });
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

    // Calculate next reset time
    const nextResetTime = new Date(userDoc.lastVoiceUsageReset!);
    nextResetTime.setDate(nextResetTime.getDate() + 1);
    nextResetTime.setHours(0, 0, 0, 0); // Reset at midnight

    res.json({
      success: true,
      usage: {
        count: userDoc.voiceUsageCount || 0,
        limit: userDoc.voiceUsageLimit || 3,
        remaining: Math.max(0, (userDoc.voiceUsageLimit || 3) - (userDoc.voiceUsageCount || 0)),
        resetTime: nextResetTime.toISOString(),
        lastResetTime: userDoc.lastVoiceUsageReset?.toISOString(),
        hoursUntilReset: Math.ceil((nextResetTime.getTime() - now.getTime()) / (1000 * 60 * 60))
      }
    });

  } catch (error: any) {
    console.error('Get voice usage error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};