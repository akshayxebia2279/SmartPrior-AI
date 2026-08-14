import { PrismaClient, DocumentExtractionStatus, Prisma } from '@prisma/client';

export interface DocumentExtractionPersistedData {
  status: DocumentExtractionStatus;
  structuredData?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  summary?: string | null;
  confidenceScore?: number | null;
  missingDocuments?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  criteriaFindings?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  explainability?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  sourceReferences?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
}

export class DocumentExtractionRepository {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  public async findLatestByDocumentId(documentId: string) {
    return this.prisma.documentExtraction.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async createPending(documentId: string) {
    return this.prisma.documentExtraction.create({
      data: {
        documentId,
        status: DocumentExtractionStatus.PENDING,
      },
    });
  }

  public async updateById(id: string, data: DocumentExtractionPersistedData) {
    return this.prisma.documentExtraction.update({
      where: { id },
      data,
    });
  }
}