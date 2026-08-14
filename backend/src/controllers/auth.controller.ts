import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  constructor(private authService: AuthService = new AuthService()) {}

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      const result = await this.authService.login(email, password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const user = await this.authService.getCurrentUser(userId);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      message:
        'Logout successful. Access tokens are stateless JWTs and remain valid until expiration unless removed on the client.',
      loggedOut: true,
    });
  };
}
