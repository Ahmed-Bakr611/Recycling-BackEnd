import "express";

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      user?: {
        userId?: string;
      };
    }
  }
}
