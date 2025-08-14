import { Request, Response, NextFunction } from 'express';

interface TranslatedRequest extends Request {
  language?: 'en' | 'ar';
}

export const languageMiddleware = (
  req: TranslatedRequest,
  res: Response,
  next: NextFunction
) => {
  const language = req.headers['accept-language']?.split(',')[0]?.substring(0, 2) as 'en' | 'ar' ||
                  req.query.lang as 'en' | 'ar' ||
                  'en';
  
  req.language = ['en', 'ar'].includes(language) ? language : 'en';
  next();
};