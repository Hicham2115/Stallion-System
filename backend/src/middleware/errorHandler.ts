import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal server error' });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
}
