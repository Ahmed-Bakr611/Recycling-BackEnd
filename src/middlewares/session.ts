import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export const ensureSessionId = (req: Request, res: Response, next: NextFunction) => {
  if (!req.cookies.sessionId) {
    const sessionId = uuidv4();
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    });
    req.sessionId = sessionId;
  } else {
    req.sessionId = req.cookies.sessionId;
  }

  next();
};