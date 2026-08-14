import { PrismaClient, RuleValidationResultType } from '@prisma/client';

export interface PersistedRuleValidation {
  insuranceRuleId: string;
  result: RuleValidationResultType;
  details: string;
  evidence: any;
}

export class RuleValidationRepository {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  public async findPriorAuthorizationWithEvidence(priorAuthorizationId: string) {
    return this.prisma.priorAuthorization.findUnique({
      where: { id: priorAuthorizationId },
      include: {
        patient: true,
        provider: true,
        insurancePlan: true,
        documents: {
          include: {
            extractions: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  public async findActiveInsuranceRules(insurancePlanId: string) {
    const now = new Date();
    return this.prisma.insuranceRule.findMany({
      where: {
        insurancePlanId,
        isActive: true,
        OR: [
          { effectiveFrom: null },
          { effectiveFrom: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { code: 'asc' },
    });
  }

  public async replaceRuleValidationResults(priorAuthorizationId: string, results: PersistedRuleValidation[]) {
    await this.prisma.$transaction(async (tx) => {
      await tx.ruleValidationResult.deleteMany({ where: { priorAuthorizationId } });
      if (!results.length) {
        return;
      }

      await tx.ruleValidationResult.createMany({
        data: results.map((item) => ({
          priorAuthorizationId,
          insuranceRuleId: item.insuranceRuleId,
          result: item.result,
          details: item.details,
          evidence: item.evidence,
          evaluatedAt: new Date(),
        })),
      });
    });
  }

  public async findLatestRuleValidationResults(priorAuthorizationId: string) {
    return this.prisma.ruleValidationResult.findMany({
      where: { priorAuthorizationId },
      include: {
        insuranceRule: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            ruleType: true,
          },
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { insuranceRule: { code: 'asc' } },
      ],
    });
  }
}
