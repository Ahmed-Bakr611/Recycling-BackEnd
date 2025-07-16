import { Request, Response, NextFunction } from "express";

interface AuthenticatedUser {
  id: string;
  role: string;
}
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthenticatedUser; // assuming it's set by `authenticate`
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
