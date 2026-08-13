import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
  details?: unknown;
}

export const errorHandler = (
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${statusCode} - ${message}`, err.stack);

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(err.details ? { details: err.details } : {}),
  });
};
