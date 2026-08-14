import { PrismaClient, DocumentType, DocumentUploadStatus, RoleName } from '@prisma/client';
import { DocumentRepository } from '../repositories/document.repository';

const ALLOWED_DOCUMENT_TYPES = Object.values(DocumentType);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/tif',
]);
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export class DocumentService {
  private repo: DocumentRepository;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.repo = new DocumentRepository(this.prisma);
  }

  public async create(data: any, actorId: string, actorRole: RoleName) {
    if (!([RoleName.ADMIN, RoleName.PROVIDER] as RoleName[]).includes(actorRole)) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    if (!data.priorAuthorizationId) {
      const err: any = new Error('Missing required field: priorAuthorizationId');
      err.statusCode = 400;
      throw err;
    }

    const documentType = data.documentType as DocumentType | undefined;
    if (!documentType || !ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      const err: any = new Error('Invalid documentType');
      err.statusCode = 400;
      throw err;
    }

    const priorAuthorization = await this.prisma.priorAuthorization.findUnique({
      where: { id: data.priorAuthorizationId },
    });

    if (!priorAuthorization) {
      const err: any = new Error('Prior authorization not found');
      err.statusCode = 404;
      throw err;
    }

    const payload: any = {
      priorAuthorizationId: data.priorAuthorizationId,
      uploadedById: actorId,
      documentType,
      originalFileName: data.originalFileName || 'uploaded-document',
      storageReference: data.storageReference || 'local://uploads/metadata',
      mimeType: data.mimeType || 'application/octet-stream',
      fileSizeBytes: Number(data.fileSizeBytes ?? 0),
      uploadStatus: data.uploadStatus || DocumentUploadStatus.UPLOADED,
    };

    if (!payload.storageReference || payload.storageReference === 'local://uploads/metadata') {
      payload.storageReference = `local://uploads/${Date.now()}-${payload.originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    }

    return this.repo.create(payload);
  }

  public async createUpload(data: any, actorId: string, actorRole: RoleName, file?: Express.Multer.File) {
    const originalFileName = data.originalFileName || file?.originalname || 'uploaded-document';

    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      const err: any = new Error('File exceeds the 50MB limit');
      err.statusCode = 400;
      throw err;
    }

    if (file) {
      const extension = (file.originalname.split('.').pop() || '').toLowerCase();
      const mimeType = file.mimetype?.toLowerCase() || '';

      if (!ALLOWED_EXTENSIONS.has(extension) && !ALLOWED_MIME_TYPES.has(mimeType)) {
        const err: any = new Error('Unsupported document type. Allowed: PDF, PNG, JPG, TIFF');
        err.statusCode = 400;
        throw err;
      }
    }

    return this.create(
      {
        ...data,
        originalFileName,
        storageReference: data.storageReference || (file ? `local://uploads/${file.filename}` : undefined),
        mimeType: data.mimeType || file?.mimetype || 'application/octet-stream',
        fileSizeBytes: data.fileSizeBytes ?? file?.size ?? 0,
        uploadStatus: data.uploadStatus || DocumentUploadStatus.UPLOADED,
      },
      actorId,
      actorRole
    );
  }

  public async getById(id: string) {
    const item = await this.repo.findById(id);
    if (!item) {
      const err: any = new Error('Document not found');
      err.statusCode = 404;
      throw err;
    }
    return item;
  }

  public async list(params: { page?: number; pageSize?: number; priorAuthorizationId?: string; documentType?: DocumentType; uploadStatus?: DocumentUploadStatus }) {
    if (params.documentType && !ALLOWED_DOCUMENT_TYPES.includes(params.documentType)) {
      const err: any = new Error('Invalid documentType filter');
      err.statusCode = 400;
      throw err;
    }

    return this.repo.findMany(params);
  }

  public async listByPriorAuthorization(priorAuthorizationId: string) {
    const priorAuthorization = await this.prisma.priorAuthorization.findUnique({
      where: { id: priorAuthorizationId },
    });

    if (!priorAuthorization) {
      const err: any = new Error('Prior authorization not found');
      err.statusCode = 404;
      throw err;
    }

    return this.repo.findMany({ priorAuthorizationId });
  }
}
