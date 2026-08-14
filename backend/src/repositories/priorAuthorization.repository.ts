import { PrismaClient, PriorAuthorizationStatus } from '@prisma/client';

export interface PriorAuthListParams {
  page?: number;
  pageSize?: number;
  status?: PriorAuthorizationStatus | null;
}

export class PriorAuthorizationRepository {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  public async create(data: any) {
    return this.prisma.priorAuthorization.create({ data: data as any });
  }

  public async findById(id: string) {
    return this.prisma.priorAuthorization.findUnique({
      where: { id },
      include: {
        patient: true,
        provider: true,
        insurancePlan: true,
        submittedBy: { select: { id: true, email: true, firstName: true, lastName: true, roleId: true } },
      },
    });
  }

  public async findMany(params: PriorAuthListParams) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));

    const where: any = {};
    if (params.status) {
      where.status = params.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.priorAuthorization.findMany({
        where,
        include: { patient: true, provider: true, insurancePlan: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.priorAuthorization.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  public async updateStatus(id: string, status: PriorAuthorizationStatus, decisionAt?: Date) {
    return this.prisma.priorAuthorization.update({
      where: { id },
      data: { status, decisionAt },
    });
  }
}
