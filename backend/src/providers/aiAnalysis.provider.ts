import { AIRecommendationType, DocumentType, Prisma, RuleValidationResultType } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env.config';

const recommendationSchema = z.object({
  recommendation: z.nativeEnum(AIRecommendationType),
  confidenceScore: z.number().min(0).max(1),
  rationale: z.string().min(1),
});

export const aiAnalysisOutcomeSchema = z.object({
  modelProvider: z.string().min(1),
  modelVersion: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
  clinicalSummary: z.string().min(1),
  missingDocuments: z.array(z.string()),
  criteriaFindings: z.array(
    z.object({
      ruleCode: z.string(),
      ruleName: z.string(),
      result: z.string(),
      details: z.string(),
    })
  ),
  explainability: z.object({
    mode: z.string().min(1),
    signals: z.array(z.string()),
  }),
  sourceReferences: z.array(
    z.object({
      documentId: z.string(),
      documentType: z.nativeEnum(DocumentType),
      storageReference: z.string(),
    })
  ),
  recommendation: recommendationSchema,
});

export type AIAnalysisOutcome = z.infer<typeof aiAnalysisOutcomeSchema>;

export interface AIAnalysisInput {
  priorAuthorizationId: string;
  requestedProcedureCode: string | null;
  requestedProcedureName: string | null;
  diagnosisCode: string | null;
  diagnosisDescription: string | null;
  requestNotes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    memberId: string | null;
  };
  provider: {
    id: string;
    name: string;
    npi: string | null;
  };
  insurancePlan: {
    id: string;
    name: string;
    planCode: string;
  };
  documents: Array<{
    id: string;
    documentType: DocumentType;
    originalFileName: string;
    storageReference: string;
    extraction: {
      status: string;
      summary: string | null;
      structuredData: Record<string, unknown> | null;
    } | null;
  }>;
  ruleValidationResults: Array<{
    insuranceRule: {
      code: string;
      name: string;
    };
    result: RuleValidationResultType;
    details: string | null;
    evidence: Record<string, unknown> | null;
  }>;
}

export interface AIAnalysisProvider {
  analyze(input: AIAnalysisInput): Promise<AIAnalysisOutcome>;
}

export class LocalAIAnalysisProvider implements AIAnalysisProvider {
  public async analyze(input: AIAnalysisInput): Promise<AIAnalysisOutcome> {
    const missingDocuments = input.ruleValidationResults
      .filter((result) => result.result === RuleValidationResultType.FAIL || result.result === RuleValidationResultType.NEEDS_INFORMATION)
      .map((result) => {
        const field = typeof result.evidence?.field === 'string' ? result.evidence.field : result.insuranceRule.code;
        return `${field}`;
      });

    const criteriaFindings = input.ruleValidationResults.map((result) => ({
      ruleCode: result.insuranceRule.code,
      ruleName: result.insuranceRule.name,
      result: result.result,
      details: result.details || 'No rule validation details were captured.',
    }));

    const allRulesPassing = input.ruleValidationResults.length > 0
      && input.ruleValidationResults.every((result) => result.result === RuleValidationResultType.PASS || result.result === RuleValidationResultType.NOT_APPLICABLE);

    const hasAnySupportingDocument = input.documents.some((document) => document.extraction?.status === 'COMPLETED');

    const recommendation = allRulesPassing
      ? {
          recommendation: AIRecommendationType.APPROVE_RECOMMENDATION,
          confidenceScore: 0.94,
          rationale: 'Required rule checks passed and supporting clinical documentation is present.',
        }
      : missingDocuments.length > 0
        ? {
            recommendation: AIRecommendationType.REQUEST_INFORMATION,
            confidenceScore: 0.82,
            rationale: 'Additional documentation or data elements are required before a final authorization recommendation can be supported.',
          }
        : {
            recommendation: AIRecommendationType.REVIEW_REQUIRED,
            confidenceScore: hasAnySupportingDocument ? 0.73 : 0.58,
            rationale: 'Available evidence is incomplete or mixed, so human reviewer adjudication is required.',
          };

    return aiAnalysisOutcomeSchema.parse({
      modelProvider: 'local-fixture',
      modelVersion: 'deterministic-v1',
      confidenceScore: recommendation.confidenceScore,
      clinicalSummary: [
        `Prior authorization ${input.priorAuthorizationId} for ${input.requestedProcedureName || input.requestedProcedureCode || 'an unspecified procedure'}.`,
        input.diagnosisCode ? `Diagnosis code ${input.diagnosisCode} is present.` : 'Diagnosis code is not present in the prior authorization payload.',
        hasAnySupportingDocument ? 'At least one extracted supporting document is available.' : 'No completed document extraction is available.',
      ].join(' '),
      missingDocuments,
      criteriaFindings,
      explainability: {
        mode: 'local-fixture',
        signals: [
          `rule-results:${input.ruleValidationResults.length}`,
          `documents:${input.documents.length}`,
          `missing-fields:${missingDocuments.length}`,
        ],
      },
      sourceReferences: input.documents.map((document) => ({
        documentId: document.id,
        documentType: document.documentType,
        storageReference: document.storageReference,
      })),
      recommendation,
    });
  }
}

class GeminiAIAnalysisProvider implements AIAnalysisProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  public async analyze(input: AIAnalysisInput): Promise<AIAnalysisOutcome> {
    const prompt = [
      'You are an insurance prior-authorization clinical analysis engine.',
      'Respond with JSON only and follow this schema exactly:',
      JSON.stringify(aiAnalysisOutcomeSchema.shape, null, 2),
      'Analyze this request context and generate an advisory recommendation:',
      JSON.stringify(input, null, 2),
    ].join('\n');

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API request failed with status ${response.status}`);
      }

      const payload = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
      if (!text) {
        throw new Error('Gemini API returned an empty analysis response');
      }

      return aiAnalysisOutcomeSchema.parse(JSON.parse(text));
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export const createAIAnalysisProvider = (): AIAnalysisProvider => {
  const geminiApiKey = env.GEMINI_API_KEY || env.AI_API_KEY;

  if (env.AI_PROVIDER === 'gemini' && geminiApiKey) {
    return new GeminiAIAnalysisProvider(geminiApiKey, env.AI_MODEL, env.AI_TIMEOUT_MS);
  }

  return new LocalAIAnalysisProvider();
};

export const asJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;