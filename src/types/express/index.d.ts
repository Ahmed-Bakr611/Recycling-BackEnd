import "express";

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      user?: {
        userId?: string;
                role?: string; // ✅ add this line

      };
    }
  }
}
