import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface PortalJwtPayload {
  clientPortalUserId: string;
  clientId: string;
  type: 'portal';
}

export interface PortalRequest extends Request {
  portalUser?: PortalJwtPayload;
}

export function portalAuthenticate(req: PortalRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as PortalJwtPayload;
    if (payload.type !== 'portal') {
      res.status(401).json({ message: 'Invalid token type' });
      return;
    }
    req.portalUser = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
