import express from 'express';
import { transcribeAudio, getVoiceUsage } from '../controllers/transcriptionController';
import { authenticate } from '../middlewares/authenticate';
import { voiceUsageLimiter } from '../middlewares/voiceUsageLimiter';
import multer from 'multer';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['audio/m4a', 'audio/mp4', 'audio/wav'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

router.post(
  '/transcribe',
  authenticate, // Your existing auth middleware
  voiceUsageLimiter, // Our new usage limiter
  upload.single('audioFile'), // Handle file upload
  transcribeAudio
);

// Get current voice usage for the authenticated user
router.get(
  '/usage',
  authenticate, // Authentication required
  getVoiceUsage
);

export default router;
