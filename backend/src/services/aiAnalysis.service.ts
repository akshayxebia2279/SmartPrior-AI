import { PrismaClient, RoleName } from '@prisma/client';
import { AIAnalysisRepository } from '../repositories/aiAnalysis.repository';
import { RuleValidationRepository } from '../repositories/ruleValidation.repository';
import { aiAnalysisOutcomeSchema, asJsonValue, createAIAnalysisProvider, AIAnalysisProvider } from '../providers/aiAnalysis.provider';

export class AIAnalysisService {
  private prisma: PrismaClient;
  private repository: AIAnalysisRepository;
  private ruleValidationRepository: RuleValidationRepository;
  private provider: AIAnalysisProvider;

  constructor(provider: AIAnalysisProvider = createAIAnalysisProvider()) {
    this.prisma = new PrismaClient();
    this.repository = new AIAnalysisRepository(this.prisma);
    this.ruleValidationRepository = new RuleValidationRepository(this.prisma);
    this.provider = provider;
  }

  public async analyze(priorAuthorizationId: string, actorRole: RoleName) {
    if (!priorAuthorizationId?.trim()) {
      const err: any = new Error('Missing prior authorization id');
      err.statusCode = 400;
      throw err;
    }

    const allowedRoles: RoleName[] = [RoleName.ADMIN, RoleName.PROVIDER];
    if (!allowedRoles.includes(actorRole)) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    const priorAuthorization = await this.repository.findPriorAuthorizationAnalysisContext(priorAuthorizationId);
    if (!priorAuthorization) {
      const err: any = new Error('Prior authorization not found');
      err.statusCode = 404;
      throw err;
    }

    const ruleValidationResults = priorAuthorization.ruleValidationResults.length > 0
      ? priorAuthorization.ruleValidationResults
      : await this.ruleValidationRepository.findLatestRuleValidationResults(priorAuthorizationId);

    const outcome = aiAnalysisOutcomeSchema.parse(
      await this.provider.analyze({
        priorAuthorizationId: priorAuthorization.id,
        requestedProcedureCode: priorAuthorization.requestedProcedureCode,
        requestedProcedureName: priorAuthorization.requestedProcedureName,
        diagnosisCode: priorAuthorization.diagnosisCode,
        diagnosisDescription: priorAuthorization.diagnosisDescription,
        requestNotes: priorAuthorization.requestNotes,
        patient: {
          id: priorAuthorization.patient.id,
          firstName: priorAuthorization.patient.firstName,
          lastName: priorAuthorization.patient.lastName,
          memberId: priorAuthorization.patient.memberId,
        },
        provider: {
          id: priorAuthorization.provider.id,
          name: priorAuthorization.provider.name,
          npi: priorAuthorization.provider.npi,
        },
        insurancePlan: {
          id: priorAuthorization.insurancePlan.id,
          name: priorAuthorization.insurancePlan.name,
          planCode: priorAuthorization.insurancePlan.planCode,
        },
        documents: priorAuthorization.documents.map((document) => ({
          id: document.id,
          documentType: document.documentType,
          originalFileName: document.originalFileName,
          storageReference: document.storageReference,
          extraction: document.extractions[0]
            ? {
                status: document.extractions[0].status,
                summary: document.extractions[0].summary,
                structuredData: (document.extractions[0].structuredData && typeof document.extractions[0].structuredData === 'object')
                  ? (document.extractions[0].structuredData as Record<string, unknown>)
                  : null,
              }
            : null,
        })),
        ruleValidationResults: ruleValidationResults.map((result) => ({
          insuranceRule: {
            code: result.insuranceRule.code,
            name: result.insuranceRule.name,
          },
          result: result.result,
          details: result.details,
          evidence: result.evidence && typeof result.evidence === 'object' ? (result.evidence as Record<string, unknown>) : null,
        })),
      })
    );

    const persisted = await this.repository.createAnalysisWithRecommendation({
      priorAuthorizationId,
      modelProvider: outcome.modelProvider,
      modelVersion: outcome.modelVersion,
      confidenceScore: outcome.confidenceScore,
      clinicalSummary: outcome.clinicalSummary,
      missingDocuments: asJsonValue(outcome.missingDocuments),
      criteriaFindings: asJsonValue(outcome.criteriaFindings),
      explainability: asJsonValue(outcome.explainability),
      sourceReferences: asJsonValue(outcome.sourceReferences),
      recommendation: outcome.recommendation,
    });

    return {
      priorAuthorizationId,
      analysis: persisted.analysis,
      recommendation: persisted.recommendation,
    };
  }

  public async getLatestAnalysis(priorAuthorizationId: string, actorRole: RoleName) {
    if (!priorAuthorizationId?.trim()) {
      const err: any = new Error('Missing prior authorization id');
      err.statusCode = 400;
      throw err;
    }

    const allowedRoles: RoleName[] = [RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER];
    if (!allowedRoles.includes(actorRole)) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    const priorAuthorization = await this.prisma.priorAuthorization.findUnique({ where: { id: priorAuthorizationId } });
    if (!priorAuthorization) {
      const err: any = new Error('Prior authorization not found');
      err.statusCode = 404;
      throw err;
    }

    const analysis = await this.repository.findLatestAnalysis(priorAuthorizationId);
    if (!analysis) {
      const err: any = new Error('AI analysis not found');
      err.statusCode = 404;
      throw err;
    }

    return {
      priorAuthorizationId,
      analysis,
      recommendation: analysis.recommendations[0] || null,
    };
  }
}