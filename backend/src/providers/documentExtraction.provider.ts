import { DocumentType, Prisma } from '@prisma/client';

export interface DocumentExtractionInput {
  id: string;
  priorAuthorizationId: string;
  uploadedById: string;
  documentType: DocumentType;
  originalFileName: string;
  storageReference: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
}

export interface DocumentExtractionOutcome {
  status: 'COMPLETED' | 'FAILED';
  structuredData: Prisma.InputJsonValue | null;
  summary: string | null;
  confidenceScore: number | null;
  missingDocuments: Prisma.InputJsonValue | null;
  criteriaFindings: Prisma.InputJsonValue | null;
  explainability: Prisma.InputJsonValue | null;
  sourceReferences: Prisma.InputJsonValue | null;
}

export interface DocumentExtractionProvider {
  extract(document: DocumentExtractionInput): Promise<DocumentExtractionOutcome>;
}

export class LocalDocumentExtractionProvider implements DocumentExtractionProvider {
  public async extract(document: DocumentExtractionInput): Promise<DocumentExtractionOutcome> {
    const forceFailure = document.originalFileName.toLowerCase().includes('force-fail');

    if (forceFailure) {
      return {
        status: 'FAILED',
        structuredData: null,
        summary: 'Local extraction fixture marked the document as failed for deterministic testing.',
        confidenceScore: null,
        missingDocuments: null,
        criteriaFindings: null,
        explainability: {
          mode: 'local-fixture',
          reason: 'Deterministic failure triggered by the uploaded filename.',
        },
        sourceReferences: [
          {
            type: 'document-metadata',
            documentId: document.id,
            storageReference: document.storageReference,
          },
        ],
      };
    }

    return {
      status: 'COMPLETED',
      structuredData: {
        documentId: document.id,
        priorAuthorizationId: document.priorAuthorizationId,
        uploadedById: document.uploadedById,
        documentType: document.documentType,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
      },
      summary: 'Local extraction fixture generated from document metadata only.',
      confidenceScore: document.documentType === DocumentType.CLINICAL_NOTE ? 0.92 : 0.84,
      missingDocuments: [],
      criteriaFindings: [
        {
          criterion: 'LOCAL_FIXTURE',
          result: 'PASS',
          detail: 'Deterministic local extraction completed without vendor-specific OCR or AI.',
        },
      ],
      explainability: {
        mode: 'local-fixture',
        note: 'No OCR or external AI service was invoked in this development implementation.',
      },
      sourceReferences: [
        {
          type: 'document-metadata',
          documentId: document.id,
          storageReference: document.storageReference,
        },
      ],
    };
  }
}