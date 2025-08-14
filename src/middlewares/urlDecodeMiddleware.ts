import { Request, Response, NextFunction } from 'express';

export const urlDecodeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Decode categoryName parameter if it exists
    if (req.params.categoryName) {
      req.params.categoryName = decodeURIComponent(req.params.categoryName);
    }
    
    // Decode any other parameters that might contain non-English text
    Object.keys(req.params).forEach(key => {
      if (req.params[key] && typeof req.params[key] === 'string') {
        try {
          // Only decode if it contains encoded characters (%)
          if (req.params[key].includes('%')) {
            req.params[key] = decodeURIComponent(req.params[key]);
          }
        } catch (decodeError) {
          // If decoding fails, keep the original value
          console.warn(`Failed to decode parameter ${key}:`, decodeError);
        }
      }
    });
    
    next();
  } catch (error) {
    console.error('URL decode middleware error:', error);
    next(); // Continue even if decoding fails
  }
};