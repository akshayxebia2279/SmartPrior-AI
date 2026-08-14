import { PrismaClient, RoleName, RuleValidationResultType } from '@prisma/client';
import { RuleValidationRepository } from '../repositories/ruleValidation.repository';

type RuleOutcome = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
type AggregateStatus = 'VALIDATION_PASSED' | 'VALIDATION_FAILED' | 'INSUFFICIENT_INFORMATION';

interface RuleResult {
  ruleIdentifier: string;
  ruleName: string;
  outcome: RuleOutcome;
  reason: string;
  context: {
    field?: string;
    source?: 'priorAuthorization' | 'documentExtraction' | 'none';
    valuePresent?: boolean;
    value?: string | number | boolean | null;
  };
}

export class RuleValidationService {
  private prisma: PrismaClient;
  private repository: RuleValidationRepository;

  constructor() {
    this.prisma = new PrismaClient();
    this.repository = new RuleValidationRepository(this.prisma);
  }

  public async evaluate(priorAuthorizationId: string, actorRole: RoleName) {
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

    const priorAuthorization = await this.repository.findPriorAuthorizationWithEvidence(priorAuthorizationId);
    if (!priorAuthorization) {
      const err: any = new Error('Prior authorization not found');
      err.statusCode = 404;
      throw err;
    }

    const activeRules = await this.repository.findActiveInsuranceRules(priorAuthorization.insurancePlanId);
    const extractedPayloads = priorAuthorization.documents.flatMap((document) =>
      document.extractions
        .filter((extraction) => extraction.status === 'COMPLETED' && extraction.structuredData && typeof extraction.structuredData === 'object')
        .map((extraction) => extraction.structuredData as Record<string, unknown>)
    );

    const results: RuleResult[] = activeRules.map((rule) => {
      const criteria = (rule.criteria && typeof rule.criteria === 'object' ? rule.criteria : {}) as Record<string, unknown>;
      const field = typeof criteria.field === 'string' ? criteria.field : undefined;
      const required = criteria.required === true;

      if (!field || !required) {
        return {
          ruleIdentifier: rule.code,
          ruleName: rule.name,
          outcome: 'NOT_APPLICABLE',
          reason: 'Rule is not configured as a required field validation.',
          context: { field, source: 'none', valuePresent: false, value: null },
        };
      }

      const priorAuthorizationValues: Record<string, unknown> = {
        diagnosisCode: priorAuthorization.diagnosisCode,
        requestedProcedureCode: priorAuthorization.requestedProcedureCode,
        requestedProcedureName: priorAuthorization.requestedProcedureName,
        requestNotes: priorAuthorization.requestNotes,
        patientId: priorAuthorization.patientId,
        providerId: priorAuthorization.providerId,
      };

      const priorAuthorizationValue = priorAuthorizationValues[field];
      if (this.hasValue(priorAuthorizationValue)) {
        return {
          ruleIdentifier: rule.code,
          ruleName: rule.name,
          outcome: 'PASS',
          reason: `Required field '${field}' is present in prior authorization data.`,
          context: {
            field,
            source: 'priorAuthorization',
            valuePresent: true,
            value: this.sanitizeValue(priorAuthorizationValue),
          },
        };
      }

      const extractionValue = this.getValueFromExtractions(extractedPayloads, field);
      if (this.hasValue(extractionValue)) {
        return {
          ruleIdentifier: rule.code,
          ruleName: rule.name,
          outcome: 'PASS',
          reason: `Required field '${field}' is present in extracted document data.`,
          context: {
            field,
            source: 'documentExtraction',
            valuePresent: true,
            value: this.sanitizeValue(extractionValue),
          },
        };
      }

      return {
        ruleIdentifier: rule.code,
        ruleName: rule.name,
        outcome: 'FAIL',
        reason: `Required field '${field}' is missing from prior authorization and extraction data.`,
        context: {
          field,
          source: 'none',
          valuePresent: false,
          value: null,
        },
      };
    });

    const passCount = results.filter((item) => item.outcome === 'PASS').length;
    const failCount = results.filter((item) => item.outcome === 'FAIL').length;
    const notApplicableCount = results.filter((item) => item.outcome === 'NOT_APPLICABLE').length;
    const missingInformationOnly = failCount > 0 && results.filter((item) => item.outcome === 'FAIL').every((item) => item.reason.includes('missing'));

    let overallStatus: AggregateStatus = 'INSUFFICIENT_INFORMATION';
    if (failCount === 0 && passCount > 0) {
      overallStatus = 'VALIDATION_PASSED';
    } else if (failCount > 0) {
      overallStatus = missingInformationOnly ? 'INSUFFICIENT_INFORMATION' : 'VALIDATION_FAILED';
    }

    const persistedRuleResults = results.map((result) => {
      let persistOutcome: RuleValidationResultType;
      if (result.outcome === 'PASS') {
        persistOutcome = RuleValidationResultType.PASS;
      } else if (result.outcome === 'NOT_APPLICABLE') {
        persistOutcome = RuleValidationResultType.NOT_APPLICABLE;
      } else {
        persistOutcome = result.reason.includes('missing') ? RuleValidationResultType.NEEDS_INFORMATION : RuleValidationResultType.FAIL;
      }

      const insuranceRule = activeRules.find((rule) => rule.code === result.ruleIdentifier)!;
      return {
        insuranceRuleId: insuranceRule.id,
        result: persistOutcome,
        details: result.reason,
        evidence: result.context,
      };
    });

    await this.repository.replaceRuleValidationResults(priorAuthorizationId, persistedRuleResults);

    return {
      priorAuthorizationId,
      overallStatus,
      summary: {
        totalRules: results.length,
        passCount,
        failCount,
        notApplicableCount,
      },
      ruleResults: results,
    };
  }

  public async getLatestEvaluation(priorAuthorizationId: string, actorRole: RoleName) {
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

    const rows = await this.repository.findLatestRuleValidationResults(priorAuthorizationId);

    const mappedResults = rows.map((row) => ({
      ruleIdentifier: row.insuranceRule.code,
      ruleName: row.insuranceRule.name,
      outcome:
        row.result === RuleValidationResultType.PASS
          ? 'PASS'
          : row.result === RuleValidationResultType.NOT_APPLICABLE
            ? 'NOT_APPLICABLE'
            : 'FAIL',
      reason: row.details || 'No reason provided.',
      context: (row.evidence || {}) as Record<string, unknown>,
      evaluatedAt: row.evaluatedAt,
    }));

    const passCount = mappedResults.filter((item) => item.outcome === 'PASS').length;
    const failCount = mappedResults.filter((item) => item.outcome === 'FAIL').length;
    const notApplicableCount = mappedResults.filter((item) => item.outcome === 'NOT_APPLICABLE').length;
    const missingInformationOnly = failCount > 0 && mappedResults.filter((item) => item.outcome === 'FAIL').every((item) => item.reason.includes('missing'));

    let overallStatus: AggregateStatus = 'INSUFFICIENT_INFORMATION';
    if (failCount === 0 && passCount > 0) {
      overallStatus = 'VALIDATION_PASSED';
    } else if (failCount > 0) {
      overallStatus = missingInformationOnly ? 'INSUFFICIENT_INFORMATION' : 'VALIDATION_FAILED';
    }

    return {
      priorAuthorizationId,
      overallStatus,
      summary: {
        totalRules: mappedResults.length,
        passCount,
        failCount,
        notApplicableCount,
      },
      ruleResults: mappedResults,
    };
  }

  private getValueFromExtractions(extractions: Record<string, unknown>[], field: string): unknown {
    for (const extraction of extractions) {
      const value = extraction[field];
      if (this.hasValue(value)) {
        return value;
      }
    }
    return null;
  }

  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return true;
  }

  private sanitizeValue(value: unknown): string | number | boolean | null {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return null;
  }
}
