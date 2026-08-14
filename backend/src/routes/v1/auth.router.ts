import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { AuthController } from '../../controllers/auth.controller';
import { authenticateRequest } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';

const authRouter = Router();
const authController = new AuthController();

authRouter.post('/login', authController.login);
authRouter.get('/me', authenticateRequest, authController.me);
authRouter.post('/logout', authenticateRequest, authController.logout);
authRouter.get('/admin-check', authenticateRequest, requireRoles(RoleName.ADMIN), (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Admin access confirmed.',
    role: req.user?.role,
    userId: req.user?.userId,
  });
});

export default authRouter;
