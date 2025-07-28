import "express";
import { ISession } from "../../models/session"; // ✅ adjust the path if needed

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      session?: ISession; // ✅ add this
      user?: {
        userId?: string;
        role?: string;
      };
    }
  }
}
