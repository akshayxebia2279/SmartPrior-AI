import { Router } from 'express';
import { authenticateRequest } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { PriorAuthorizationController } from '../../controllers/priorAuthorization.controller';
import { DocumentController } from '../../controllers/document.controller';
import { RoleName } from '@prisma/client';

const router = Router();
const controller = new PriorAuthorizationController();
const documentController = new DocumentController();

// All routes require authentication
router.use(authenticateRequest);

// Create: Provider or Admin
router.post('/', requireRoles(RoleName.PROVIDER, RoleName.ADMIN), controller.create);

// List: Admin/Provider/Reviewer
router.get('/', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.list);

// Document history for a given authorization
router.get('/:id/documents', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), documentController.listByPriorAuthorization);

// Get by id
router.get('/:id', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.getById);

// Update status
router.patch('/:id/status', controller.updateStatus);

export default router;
