import { RoleName } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { createAuthError } from '../services/auth.service';

export const requireRoles = (...allowedRoles: RoleName[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createAuthError(401, 'Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(createAuthError(403, 'Access denied'));
      return;
    }

    next();
  };
};
