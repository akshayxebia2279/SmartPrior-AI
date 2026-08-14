import { PrismaClient, PriorAuthorizationStatus, RoleName } from '@prisma/client';
import { PriorAuthorizationRepository } from '../repositories/priorAuthorization.repository';

const PRIOR_AUTH_STATUS_VALUES = Object.values(PriorAuthorizationStatus);

export class PriorAuthorizationService {
  private repo: PriorAuthorizationRepository;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.repo = new PriorAuthorizationRepository(this.prisma);
  }

  public async create(data: any, actorId: string, actorRole: RoleName) {
    // Basic validation
    if (!data.patientId || !data.providerId || !data.insurancePlanId) {
      const err: any = new Error('Missing required fields: patientId, providerId, insurancePlanId');
      err.statusCode = 400;
      throw err;
    }

    // Only providers or admins allowed to create
    if (!( [RoleName.ADMIN, RoleName.PROVIDER] as RoleName[] ).includes(actorRole)) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    const requestedStatus = data.status as PriorAuthorizationStatus | undefined;
    if (requestedStatus && !PRIOR_AUTH_STATUS_VALUES.includes(requestedStatus)) {
      const err: any = new Error('Invalid status value');
      err.statusCode = 400;
      throw err;
    }
    if (actorRole === RoleName.PROVIDER && requestedStatus && requestedStatus !== PriorAuthorizationStatus.DRAFT) {
      const err: any = new Error('Providers can only create draft prior authorizations');
      err.statusCode = 403;
      throw err;
    }

    // Ensure referenced entities exist
    const [patient, provider, plan] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: data.patientId } }),
      this.prisma.provider.findUnique({ where: { id: data.providerId } }),
      this.prisma.insurancePlan.findUnique({ where: { id: data.insurancePlanId } }),
    ]);

    if (!patient || !provider || !plan) {
      const err: any = new Error('Referenced patient/provider/insurancePlan not found');
      err.statusCode = 400;
      throw err;
    }

    const createData: any = {
      patientId: data.patientId,
      providerId: data.providerId,
      insurancePlanId: data.insurancePlanId,
      requestedProcedureCode: data.requestedProcedureCode || null,
      requestedProcedureName: data.requestedProcedureName || null,
      diagnosisCode: data.diagnosisCode || null,
      diagnosisDescription: data.diagnosisDescription || null,
      requestNotes: data.requestNotes || null,
      externalReference: data.externalReference || null,
      submittedById: actorId,
      status: actorRole === RoleName.ADMIN && requestedStatus ? requestedStatus : PriorAuthorizationStatus.DRAFT,
      priority: data.priority || 'ROUTINE',
      submittedAt: data.submittedAt ? new Date(data.submittedAt) : null,
    };

    return this.repo.create(createData);
  }

  public async getById(id: string) {
    const item = await this.repo.findById(id);
    if (!item) {
      const err: any = new Error('Not found');
      err.statusCode = 404;
      throw err;
    }
    return item;
  }

  public async list(params: { page?: number; pageSize?: number; status?: string }) {
    if (params.status && !PRIOR_AUTH_STATUS_VALUES.includes(params.status as PriorAuthorizationStatus)) {
      const err: any = new Error('Invalid status filter');
      err.statusCode = 400;
      throw err;
    }

    const p = { page: params.page, pageSize: params.pageSize, status: params.status } as any;
    return this.repo.findMany(p);
  }

  public async updateStatus(id: string, newStatus: PriorAuthorizationStatus, actorRole: RoleName) {
    if (!newStatus || !PRIOR_AUTH_STATUS_VALUES.includes(newStatus)) {
      const err: any = new Error('Invalid status value');
      err.statusCode = 400;
      throw err;
    }

    const item = await this.prisma.priorAuthorization.findUnique({ where: { id } });
    if (!item) {
      const err: any = new Error('Not found');
      err.statusCode = 404;
      throw err;
    }

    // Simple transition rules
    const from = item.status;
    const to = newStatus;
    if (from === to) {
      const err: any = new Error('Status unchanged');
      err.statusCode = 409;
      throw err;
    }

    // Provider can submit from DRAFT -> SUBMITTED
    if (actorRole === RoleName.PROVIDER) {
      if (!(from === 'DRAFT' && to === 'SUBMITTED')) {
        const err: any = new Error('Providers may only submit drafts');
        err.statusCode = 403;
        throw err;
      }
    }

    // Only REVIEWER or ADMIN can make review decisions (APPROVED/REJECTED/REQUEST_INFORMATION)
    if ([ 'APPROVED', 'REJECTED', 'REQUEST_INFORMATION' ].includes(to)) {
      if (!( [RoleName.ADMIN, RoleName.REVIEWER] as RoleName[] ).includes(actorRole)) {
        const err: any = new Error('Access denied');
        err.statusCode = 403;
        throw err;
      }
    }

    // Apply update
    const updated = await this.repo.updateStatus(id, to as PriorAuthorizationStatus, to === 'APPROVED' || to === 'REJECTED' ? new Date() : undefined);
    return updated;
  }
}
