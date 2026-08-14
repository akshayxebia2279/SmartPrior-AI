import { DocumentExtractionStatus, DocumentUploadStatus, Prisma, PrismaClient, RoleName } from '@prisma/client';
import { DocumentRepository } from '../repositories/document.repository';
import {
  DocumentExtractionProvider,
  LocalDocumentExtractionProvider,
} from '../providers/documentExtraction.provider';
import { DocumentExtractionRepository } from '../repositories/documentExtraction.repository';

const PROCESSABLE_STATUSES = new Set<DocumentUploadStatus>([
  DocumentUploadStatus.UPLOADED,
  DocumentUploadStatus.FAILED,
]);

const jsonValueOrDbNull = (value: Prisma.InputJsonValue | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => {
  return value === null ? Prisma.DbNull : value;
};

export class DocumentExtractionService {
  private prisma: PrismaClient;
  private documentRepository: DocumentRepository;
  private extractionRepository: DocumentExtractionRepository;
  private provider: DocumentExtractionProvider;

  constructor(provider: DocumentExtractionProvider = new LocalDocumentExtractionProvider()) {
    this.prisma = new PrismaClient();
    this.documentRepository = new DocumentRepository(this.prisma);
    this.extractionRepository = new DocumentExtractionRepository(this.prisma);
    this.provider = provider;
  }

  public async startProcessing(documentId: string, actorId: string, actorRole: RoleName) {
    if (!documentId || !documentId.trim()) {
      const err: any = new Error('Missing document id');
      err.statusCode = 400;
      throw err;
    }

    const allowedRoles: RoleName[] = [RoleName.ADMIN, RoleName.PROVIDER];
    if (!allowedRoles.includes(actorRole)) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      const err: any = new Error('Document not found');
      err.statusCode = 404;
      throw err;
    }

    if (actorRole === RoleName.PROVIDER && document.uploadedById !== actorId) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    if (!PROCESSABLE_STATUSES.has(document.uploadStatus)) {
      const err: any = new Error('Document is not in a processable state');
      err.statusCode = 409;
      throw err;
    }

    const existingExtraction = await this.extractionRepository.findLatestByDocumentId(documentId);
    if (existingExtraction?.status === DocumentExtractionStatus.COMPLETED) {
      const err: any = new Error('Document has already been processed');
      err.statusCode = 409;
      throw err;
    }

    if (document.uploadStatus === DocumentUploadStatus.PROCESSING) {
      const err: any = new Error('Document is already being processed');
      err.statusCode = 409;
      throw err;
    }

    let extractionRecord = existingExtraction;
    if (!extractionRecord) {
      extractionRecord = await this.extractionRepository.createPending(document.id);
    } else if (extractionRecord.status === DocumentExtractionStatus.FAILED) {
      extractionRecord = await this.extractionRepository.updateById(extractionRecord.id, {
        status: DocumentExtractionStatus.PENDING,
        structuredData: Prisma.DbNull,
        summary: null,
        confidenceScore: null,
        missingDocuments: Prisma.DbNull,
        criteriaFindings: Prisma.DbNull,
        explainability: Prisma.DbNull,
        sourceReferences: Prisma.DbNull,
      });
    } else if (extractionRecord.status === DocumentExtractionStatus.PENDING) {
      const err: any = new Error('Document is already being processed');
      err.statusCode = 409;
      throw err;
    }

    await this.documentRepository.updateUploadStatus(document.id, DocumentUploadStatus.PROCESSING);

    try {
      const outcome = await this.provider.extract({
        id: document.id,
        priorAuthorizationId: document.priorAuthorizationId,
        uploadedById: document.uploadedById,
        documentType: document.documentType,
        originalFileName: document.originalFileName,
        storageReference: document.storageReference,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
      });

      const persistedExtraction = await this.extractionRepository.updateById(extractionRecord.id, {
        status:
          outcome.status === 'COMPLETED'
            ? DocumentExtractionStatus.COMPLETED
            : DocumentExtractionStatus.FAILED,
        structuredData: jsonValueOrDbNull(outcome.structuredData),
        summary: outcome.summary,
        confidenceScore: outcome.confidenceScore,
        missingDocuments: jsonValueOrDbNull(outcome.missingDocuments),
        criteriaFindings: jsonValueOrDbNull(outcome.criteriaFindings),
        explainability: jsonValueOrDbNull(outcome.explainability),
        sourceReferences: jsonValueOrDbNull(outcome.sourceReferences),
      });

      await this.documentRepository.updateUploadStatus(
        document.id,
        outcome.status === 'COMPLETED' ? DocumentUploadStatus.PROCESSED : DocumentUploadStatus.FAILED
      );

      const refreshedDocument = await this.documentRepository.findById(document.id);
      return {
        document: refreshedDocument,
        extraction: persistedExtraction,
      };
    } catch (error) {
      await this.extractionRepository.updateById(extractionRecord.id, {
        status: DocumentExtractionStatus.FAILED,
        summary: 'Document extraction failed.',
      });
      await this.documentRepository.updateUploadStatus(document.id, DocumentUploadStatus.FAILED);

      const err: any = new Error('Document extraction failed');
      err.statusCode = 500;
      throw err;
    }
  }
}