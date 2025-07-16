import { TokenPayload } from '../../middlewares/auth'

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      iat?: number;
      exp?: number;
    };
    sessionId?: string;
  }
}