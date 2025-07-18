import { Request, Response, NextFunction } from "express";


interface AuthenticatedUser {
  userId: string;
  role: string;
}
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthenticatedUser | undefined;

    console.log("Authorize middleware user:", req.user.role);

    if (!user || !user.role || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};