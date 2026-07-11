import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = err.status || 500;
  const message = err.message || 'An unexpected error occurred on the server.';
  
  logger.error(`Exception caught: ${message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(status).json({
    error: message,
    status,
    timestamp: new Date().toISOString(),
  });
}
