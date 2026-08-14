import { NextFunction, Request, Response } from 'express';
import { AuthService, createAuthError } from '../services/auth.service';

const authService = new AuthService();

export const authenticateRequest = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(createAuthError(401, 'Missing or invalid Authorization header'));
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    next(createAuthError(401, 'Missing token'));
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    const user = await authService.loadAuthenticatedUser(payload.userId);

    if (!user) {
      next(createAuthError(401, 'Authentication failed'));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
