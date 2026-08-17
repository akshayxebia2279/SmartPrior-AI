import { PrismaClient, PriorAuthorizationStatus, ReviewerDecisionType, RoleName } from '@prisma/client';
import { PriorAuthorizationRepository } from '../repositories/priorAuthorization.repository';

const PRIOR_AUTH_STATUS_VALUES = Object.values(PriorAuthorizationStatus);
const REVIEWER_DECISION_VALUES = new Set(['APPROVED', 'DENIED', 'REJECTED']);

export class PriorAuthorizationService {
  private repo: PriorAuthorizationRepository;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.repo = new PriorAuthorizationRepository(this.prisma);
  }

  private normalizeText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private async requireValidEntityId<T extends { id: string }>(
    entityName: 'patient' | 'provider' | 'insurancePlan',
    id: string,
    lookup: () => Promise<T | null>,
    label: string,
  ) {
    const record = await lookup();
    if (!record) {
      const err: any = new Error(`No matching ${entityName} found for ${label}.`);
      err.statusCode = 400;
      throw err;
    }
    return record.id;
  }

  private parsePatientName(value: string | null): { firstName: string | null; lastName: string | null } {
    const normalized = this.normalizeText(value);
    if (!normalized) return { firstName: null, lastName: null };

    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: null, lastName: null };
    if (parts.length === 1) return { firstName: parts[0], lastName: null };

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private normalizePriority(value: unknown): 'ROUTINE' | 'URGENT' | 'EXPEDITED' | null {
    const raw = this.normalizeText(typeof value === 'string' ? value : undefined);
    if (!raw) {
      return null;
    }

    switch (raw.toUpperCase()) {
      case 'ROUTINE':
        return 'ROUTINE';
      case 'URGENT':
        return 'URGENT';
      case 'EXPEDITED':
        return 'EXPEDITED';
      default:
        return null;
    }
  }

  private async resolvePatientId(data: any) {
    const explicitId = this.normalizeText(data.patientId ?? data.patient?.id ?? data.patient_id);
    if (explicitId) {
      return this.requireValidEntityId('patient', explicitId, () => this.prisma.patient.findUnique({ where: { id: explicitId } }), `id ${explicitId}`);
    }

    const patientInput = data.patient ?? {};
    const memberId = this.normalizeText(patientInput.memberId ?? data.memberId);
    const mrn = this.normalizeText(patientInput.mrn ?? data.mrn);
    const email = this.normalizeText(patientInput.email ?? data.email);
    const fullName = this.normalizeText(patientInput.name ?? data.patientName ?? patientInput.fullName ?? data.fullName);
    const { firstName, lastName } = this.parsePatientName(fullName);

    if (memberId) {
      const patient = await this.prisma.patient.findUnique({ where: { memberId } });
      if (patient) {
        return patient.id;
      }
      const err: any = new Error(`No matching patient found for memberId "${memberId}".`);
      err.statusCode = 400;
      throw err;
    }

    if (mrn) {
      const patient = await this.prisma.patient.findUnique({ where: { mrn } });
      if (patient) {
        return patient.id;
      }
      const err: any = new Error(`No matching patient found for MRN "${mrn}".`);
      err.statusCode = 400;
      throw err;
    }

    if (email) {
      const patient = await this.prisma.patient.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
      if (patient) {
        return patient.id;
      }
      const err: any = new Error(`No matching patient found for email "${email}".`);
      err.statusCode = 400;
      throw err;
    }

    if (firstName || lastName) {
      const patient = await this.prisma.patient.findFirst({
        where: {
          firstName: firstName ? { equals: firstName, mode: 'insensitive' } : undefined,
          lastName: lastName ? { equals: lastName, mode: 'insensitive' } : undefined,
        },
      });

      if (patient) {
        return patient.id;
      }

      const err: any = new Error(`No matching patient found for "${fullName}".`);
      err.statusCode = 400;
      throw err;
    }

    const err: any = new Error('Missing valid patient selection. Please choose an existing patient.');
    err.statusCode = 400;
    throw err;
  }

  private async resolveProviderId(data: any, actorId?: string, actorRole?: RoleName) {
    const explicitId = this.normalizeText(data.providerId ?? data.provider?.id ?? data.provider_id);
    if (explicitId) {
      const provider = await this.prisma.provider.findUnique({ where: { id: explicitId } });
      if (!provider) {
        const err: any = new Error(`No matching provider found for id "${explicitId}".`);
        err.statusCode = 400;
        throw err;
      }
      return provider.id;
    }

    if (actorRole === RoleName.PROVIDER && actorId) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { providerId: true },
      });

      if (currentUser?.providerId) {
        const provider = await this.prisma.provider.findUnique({ where: { id: currentUser.providerId } });
        if (!provider) {
          const err: any = new Error('Authenticated provider is not linked to a valid provider record.');
          err.statusCode = 400;
          throw err;
        }

        return provider.id;
      }
    }

    const providerInput = data.provider;
    const providerName = this.normalizeText(typeof providerInput === 'string' ? providerInput : providerInput?.name);

    if (!providerName) {
      const err: any = new Error('Missing required fields: patientId, providerId, insurancePlanId');
      err.statusCode = 400;
      throw err;
    }

    const provider = await this.prisma.provider.findFirst({
      where: {
        OR: [
          { name: { equals: providerName, mode: 'insensitive' } },
          { npi: providerName },
        ],
      },
    });

    if (!provider) {
      const err: any = new Error(`No matching provider found for "${providerName}".`);
      err.statusCode = 400;
      throw err;
    }

    return provider.id;
  }

  private async resolveInsurancePlanId(data: any) {
    const explicitId = this.normalizeText(data.insurancePlanId ?? data.insurancePlan?.id ?? data.insurance_plan_id);
    if (explicitId) {
      const plan = await this.prisma.insurancePlan.findUnique({ where: { id: explicitId } });
      if (!plan) {
        const err: any = new Error(`No matching insurance plan found for id "${explicitId}".`);
        err.statusCode = 400;
        throw err;
      }
      return plan.id;
    }

    const planInput = data.insurancePlan;
    const planName = this.normalizeText(typeof planInput === 'string' ? planInput : planInput?.name);

    if (!planName) {
      const err: any = new Error('Missing required fields: patientId, providerId, insurancePlanId');
      err.statusCode = 400;
      throw err;
    }

    const plan = await this.prisma.insurancePlan.findFirst({
      where: {
        OR: [
          { name: { equals: planName, mode: 'insensitive' } },
          { planCode: planName },
        ],
      },
    });

    if (!plan) {
      const err: any = new Error(`No matching insurance plan found for "${planName}".`);
      err.statusCode = 400;
      throw err;
    }

    return plan.id;
  }

  public async create(data: any, actorId: string, actorRole: RoleName) {
    const patientId = await this.resolvePatientId(data);
    const providerId = await this.resolveProviderId(data, actorId, actorRole);
    const insurancePlanId = await this.resolveInsurancePlanId(data);

    data.patientId = patientId;
    data.providerId = providerId;
    data.insurancePlanId = insurancePlanId;

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

    const normalizedPriority = this.normalizePriority(data.priority ?? 'ROUTINE');
    if (!normalizedPriority) {
      const err: any = new Error('Invalid priority value');
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
      priority: normalizedPriority,
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

  public async recordReviewerDecision(
    id: string,
    payload: { decision?: string; reason?: string },
    reviewerId: string,
    actorRole: RoleName,
  ) {
    if (actorRole !== RoleName.REVIEWER) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    const priorAuthorization = await this.prisma.priorAuthorization.findUnique({ where: { id } });
    if (!priorAuthorization) {
      const err: any = new Error('Not found');
      err.statusCode = 404;
      throw err;
    }

    const rawDecision = typeof payload.decision === 'string' ? payload.decision.trim().toUpperCase() : '';
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';

    if (!REVIEWER_DECISION_VALUES.has(rawDecision) || !reason) {
      const err: any = new Error('Invalid decision payload');
      err.statusCode = 400;
      throw err;
    }

    if (
      priorAuthorization.status === PriorAuthorizationStatus.APPROVED
      || priorAuthorization.status === PriorAuthorizationStatus.REJECTED
    ) {
      const err: any = new Error('Prior authorization already has a final decision');
      err.statusCode = 409;
      throw err;
    }

    const existingDecision = await this.repo.findLatestReviewerDecision(id);
    if (existingDecision) {
      const err: any = new Error('Reviewer decision already recorded');
      err.statusCode = 409;
      throw err;
    }

    const normalizedDecision = rawDecision === 'DENIED' ? ReviewerDecisionType.REJECTED : rawDecision as ReviewerDecisionType;
    if (!(normalizedDecision === ReviewerDecisionType.APPROVED || normalizedDecision === ReviewerDecisionType.REJECTED)) {
      const err: any = new Error('Invalid decision payload');
      err.statusCode = 400;
      throw err;
    }

    const finalStatus = normalizedDecision === ReviewerDecisionType.APPROVED
      ? PriorAuthorizationStatus.APPROVED
      : PriorAuthorizationStatus.REJECTED;

    const result = await this.repo.createReviewerDecisionAndUpdateStatus(
      id,
      reviewerId,
      normalizedDecision,
      reason,
      finalStatus,
    );

    return {
      success: true,
      data: {
        priorAuthorizationId: result.priorAuthorization.id,
        decision: result.reviewerDecision.decision,
        status: result.priorAuthorization.status,
        reason: result.reviewerDecision.rationale,
        reviewedAt: result.reviewerDecision.reviewedAt,
      },
    };
  }
}
