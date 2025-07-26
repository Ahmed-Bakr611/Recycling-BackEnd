// src/middlewares/pagination.ts
import { Request, Response, NextFunction } from "express";

// 1. Stronger typing for pagination result
interface PaginationResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

// 2. Configurable options with defaults
interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export const paginate = (options: PaginationOptions = {}) => {
  const defaultLimit = options.defaultLimit || 10;
  const maxLimit = options.maxLimit || 100;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate pagination parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      let limit = Math.min(
        maxLimit,
        Math.max(1, parseInt(req.query.limit as string) || defaultLimit)
      );
      const skip = (page - 1) * limit;

      // Attach to request
      req.pagination = { page, limit, skip };

      // Enhanced response method with validation
      res.paginated = <T>(data: T[], total: number) => {
        const totalPages = Math.ceil(total / limit);

        // Validate page isn't beyond available data
        if (skip >= total && total > 0) {
          return res.status(400).json({
            error: "Invalid pagination",
            message: `Requested page ${page} exceeds available items`,
            maxValidPage: Math.ceil(total / limit),
          });
        }

        const result: PaginationResult<T> = {
          data,
          pagination: {
            currentPage: page,
            itemsPerPage: limit,
            totalItems: total,
            totalPages,
            hasNextPage: page < totalPages,
          },
        };

        res.json(result);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};
// 6. Extended type definitions
declare global {
  namespace Express {
    interface Request {
      pagination: {
        page: number;
        limit: number;
        skip: number;
      };
    }

    interface Response {
      paginated: <T>(data: T[], total: number) => void;
    }
  }
}
