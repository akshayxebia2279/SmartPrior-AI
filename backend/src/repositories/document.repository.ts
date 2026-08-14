import { PrismaClient, DocumentType, DocumentUploadStatus } from '@prisma/client';

export interface DocumentListParams {
  page?: number;
  pageSize?: number;
  priorAuthorizationId?: string;
  documentType?: DocumentType | null;
  uploadStatus?: DocumentUploadStatus | null;
}

export class DocumentRepository {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  public async create(data: any) {
    return this.prisma.document.create({ data });
  }

  public async findById(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        priorAuthorization: {
          select: {
            id: true,
            status: true,
            requestedProcedureCode: true,
            requestedProcedureName: true,
            diagnosisCode: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: { select: { name: true } },
          },
        },
        extractions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  public async updateUploadStatus(id: string, uploadStatus: DocumentUploadStatus) {
    return this.prisma.document.update({
      where: { id },
      data: { uploadStatus },
    });
  }

  public async findMany(params: DocumentListParams) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));

    const where: any = {};
    if (params.priorAuthorizationId) {
      where.priorAuthorizationId = params.priorAuthorizationId;
    }
    if (params.documentType) {
      where.documentType = params.documentType;
    }
    if (params.uploadStatus) {
      where.uploadStatus = params.uploadStatus;
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          priorAuthorization: {
            select: {
              id: true,
              status: true,
              requestedProcedureCode: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
