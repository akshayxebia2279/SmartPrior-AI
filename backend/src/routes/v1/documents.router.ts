import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { RoleName } from '@prisma/client';
import { DocumentController } from '../../controllers/document.controller';
import { authenticateRequest } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { MAX_FILE_SIZE_BYTES } from '../../services/document.service';

const router = Router();
const controller = new DocumentController();

const uploadDir = path.resolve(__dirname, '../../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req: Express.Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
      callback(null, uploadDir);
    },
    filename: (_req: Express.Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      callback(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    const extension = (file.originalname.split('.').pop() || '').toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    const allowedExtensions = new Set(['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff']);
    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/tiff',
      'image/tif',
    ]);

    if (allowedExtensions.has(extension) || allowedMimeTypes.has(mimeType)) {
      callback(null, true);
      return;
    }

    callback(new Error('Unsupported document type. Allowed: PDF, PNG, JPG, TIFF'));
  },
});

router.use(authenticateRequest);

router.post('/', requireRoles(RoleName.PROVIDER, RoleName.ADMIN), controller.create);
router.post('/upload', requireRoles(RoleName.PROVIDER, RoleName.ADMIN), upload.single('file'), controller.upload);
router.post('/:id/extraction', requireRoles(RoleName.ADMIN, RoleName.PROVIDER), controller.startExtraction);
router.get('/prior-authorization/:id', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.listByPriorAuthorization);
router.get('/', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.list);
router.get('/:id', requireRoles(RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER), controller.getById);

export default router;
