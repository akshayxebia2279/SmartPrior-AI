import { AIAnalysisStatus, AIRecommendationType, Prisma, PrismaClient } from '@prisma/client';

export interface PersistedAIRecommendationInput {
  recommendation: AIRecommendationType;
  confidenceScore: number;
  rationale: string;
}

export interface PersistedAIAnalysisInput {
  priorAuthorizationId: string;
  modelProvider: string;
  modelVersion: string;
  confidenceScore: number;
  clinicalSummary: string;
  missingDocuments: Prisma.InputJsonValue;
  criteriaFindings: Prisma.InputJsonValue;
  explainability: Prisma.InputJsonValue;
  sourceReferences: Prisma.InputJsonValue;
  recommendation: PersistedAIRecommendationInput;
}

export class AIAnalysisRepository {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  public async findPriorAuthorizationAnalysisContext(priorAuthorizationId: string) {
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
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        ruleValidationResults: {
          include: {
            insuranceRule: {
              select: {
                code: true,
                name: true,
              },
            },
          },
          orderBy: [
            { updatedAt: 'desc' },
            { insuranceRule: { code: 'asc' } },
          ],
        },
      },
    });
  }

  public async createAnalysisWithRecommendation(input: PersistedAIAnalysisInput) {
    return this.prisma.$transaction(async (tx) => {
      const analysis = await tx.aIAnalysis.create({
        data: {
          priorAuthorizationId: input.priorAuthorizationId,
          analysisStatus: AIAnalysisStatus.COMPLETED,
          modelProvider: input.modelProvider,
          modelVersion: input.modelVersion,
          processingTimeMs: null,
          confidenceScore: input.confidenceScore,
          clinicalSummary: input.clinicalSummary,
          missingDocuments: input.missingDocuments,
          criteriaFindings: input.criteriaFindings,
          explainability: input.explainability,
          sourceReferences: input.sourceReferences,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const recommendation = await tx.aIRecommendation.create({
        data: {
          priorAuthorizationId: input.priorAuthorizationId,
          aiAnalysisId: analysis.id,
          recommendation: input.recommendation.recommendation,
          confidenceScore: input.recommendation.confidenceScore,
          rationale: input.recommendation.rationale,
        },
      });

      return { analysis, recommendation };
    });
  }

  public async findLatestAnalysis(priorAuthorizationId: string) {
    return this.prisma.aIAnalysis.findFirst({
      where: { priorAuthorizationId },
      include: {
        recommendations: {
          orderBy: { generatedAt: 'desc' },
        },
      },
      orderBy: [
        { completedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }
}