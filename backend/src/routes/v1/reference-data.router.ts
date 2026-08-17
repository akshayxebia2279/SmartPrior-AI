import { Router } from 'express';
import { authenticateRequest } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { ReferenceDataController } from '../../controllers/referenceData.controller';
import { RoleName } from '@prisma/client';

const router = Router();
const controller = new ReferenceDataController();

router.use(authenticateRequest);
router.get('/patients', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.listPatients);
router.get('/providers', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.listProviders);
router.get('/insurance-plans', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.listInsurancePlans);

export default router;
