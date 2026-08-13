import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const prisma = new PrismaClient();

// Use the exact model names as they appear in prisma/schema.prisma
const REQUIRED_MODELS = [
  'Role',
  'User',
  'Provider',
  'InsuranceCompany',
  'InsurancePlan',
  'InsuranceRule',
  'Patient',
  'PriorAuthorization',
  'Document',
  'DocumentExtraction',
  'RuleValidationResult',
  'AIAnalysis',
  'AIRecommendation',
  'ReviewerDecision',
  'Notification',
  'AuditLog',
] as const;

const DEMO_SCENARIOS = [
  {
    key: 'scenario-approve',
    externalReference: 'PA-DEMO-001',
    status: 'APPROVED',
    priority: 'ROUTINE',
    patient: {
      memberId: 'MEM-1001',
      mrn: 'MRN-1001',
      firstName: 'Dorian',
      lastName: 'Parker',
      dateOfBirth: '1991-05-14T00:00:00.000Z',
      gender: 'F',
    },
    document: {
      filename: 'demo_prior_auth_001_clinical_note.pdf',
      storageReference: 's3://smartprior-demo/documents/PA-DEMO-001/clinical-note.pdf',
      documentType: 'CLINICAL_NOTE',
      uploadStatus: 'PROCESSED',
    },
    ai: {
      analysisStatus: 'COMPLETED',
      confidenceScore: 0.97,
      clinicalSummary: 'Patient demonstrates documented diagnosis and physician treatment plan consistent with submitted therapy. All required evidence is present, with no missing documentation.',
      missingDocuments: [],
      criteriaFindings: [
        { ruleCode: 'DIAGNOSIS_REQ', result: 'PASS', detail: 'ICD-10 diagnosis matches submitted request.' },
        { ruleCode: 'PHYSICIAN_ORDER_REQ', result: 'PASS', detail: 'Order signed by licensed physician on file.' },
        { ruleCode: 'DOCUMENTATION_REQ', result: 'PASS', detail: 'Clinical notes and treatment plan are complete.' },
      ],
      explainability: {
        sources: ['PA-DEMO-001/clinical-note.pdf', 'PA-DEMO-001/office-note.pdf'],
        rationale: 'Evidence aligns with insurer criteria and submitted procedure history.',
      },
      sourceReferences: ['page-1', 'page-3'],
    },
    recommendation: {
      type: 'APPROVE_RECOMMENDATION',
      confidence: 0.96,
      rationale: 'All criteria pass based on the uploaded documentation and physician order evidence.',
    },
    reviewerDecision: {
      decision: 'APPROVED',
      rationale: 'Human review confirms the documented criteria are met and the medical necessity is supported.',
    },
    notification: {
      type: 'STATUS_UPDATE',
      channel: 'EMAIL',
      status: 'SENT',
      subject: 'Prior Authorization Approved',
      message: 'Your prior authorization request has been approved after reviewer verification.',
    },
    audit: {
      action: 'PRIOR_AUTHORIZATION_CREATED',
      entityType: 'PriorAuthorization',
      entityId: 'PA-DEMO-001',
      correlationId: 'corr-pa-demo-001-01',
      metadata: { scenario: 'approve', workflow: 'approval' },
    },
  },
  {
    key: 'scenario-request-info',
    externalReference: 'PA-DEMO-002',
    status: 'REQUEST_INFORMATION',
    priority: 'URGENT',
    patient: {
      memberId: 'MEM-1002',
      mrn: 'MRN-1002',
      firstName: 'Evelyn',
      lastName: 'Nguyen',
      dateOfBirth: '1989-09-22T00:00:00.000Z',
      gender: 'F',
    },
    document: {
      filename: 'demo_prior_auth_002_incomplete_upload.pdf',
      storageReference: 's3://smartprior-demo/documents/PA-DEMO-002/clinical-note.pdf',
      documentType: 'CLINICAL_NOTE',
      uploadStatus: 'PROCESSED',
    },
    ai: {
      analysisStatus: 'COMPLETED',
      confidenceScore: 0.82,
      clinicalSummary: 'Submitted documentation is partially complete, but required imaging and office note evidence are absent. The treatment plan is not fully supported by available records.',
      missingDocuments: ['ordering_physician_note.pdf', 'imaging_summary.pdf'],
      criteriaFindings: [
        { ruleCode: 'DOCUMENTATION_REQ', result: 'NEEDS_INFORMATION', detail: 'Clinical documentation is incomplete.' },
        { ruleCode: 'IMAGING_REQ', result: 'NEEDS_INFORMATION', detail: 'Required imaging summary is missing.' },
      ],
      explainability: {
        sources: ['PA-DEMO-002/clinical-note.pdf'],
        rationale: 'The AI flags missing documentation and incomplete medical necessity evidence.',
      },
      sourceReferences: ['page-1'],
    },
    recommendation: {
      type: 'REQUEST_INFORMATION',
      confidence: 0.88,
      rationale: 'Please provide the missing office note and imaging summary before final review.',
    },
    reviewerDecision: {
      decision: 'REQUEST_INFORMATION',
      rationale: 'The request is clinically plausible, but additional documentation is required to validate medical necessity.',
    },
    notification: {
      type: 'STATUS_UPDATE',
      channel: 'EMAIL',
      status: 'SENT',
      subject: 'Additional Information Requested',
      message: 'Please upload the missing physician note and imaging summary for review.',
    },
    audit: {
      action: 'PRIOR_AUTHORIZATION_CREATED',
      entityType: 'PriorAuthorization',
      entityId: 'PA-DEMO-002',
      correlationId: 'corr-pa-demo-002-01',
      metadata: { scenario: 'request-info', workflow: 'needs-info' },
    },
  },
  {
    key: 'scenario-reject',
    externalReference: 'PA-DEMO-003',
    status: 'REJECTED',
    priority: 'EXPEDITED',
    patient: {
      memberId: 'MEM-1003',
      mrn: 'MRN-1003',
      firstName: 'Marcus',
      lastName: 'Olsen',
      dateOfBirth: '1978-12-04T00:00:00.000Z',
      gender: 'M',
    },
    document: {
      filename: 'demo_prior_auth_003_failures.pdf',
      storageReference: 's3://smartprior-demo/documents/PA-DEMO-003/clinical-note.pdf',
      documentType: 'CLINICAL_NOTE',
      uploadStatus: 'PROCESSED',
    },
    ai: {
      analysisStatus: 'COMPLETED',
      confidenceScore: 0.91,
      clinicalSummary: 'The submitted treatment request does not meet the insurer’s diagnosed-condition and prior-treatment requirements. Requested therapy is not supported by evidence on file.',
      missingDocuments: [],
      criteriaFindings: [
        { ruleCode: 'DIAGNOSIS_REQ', result: 'FAIL', detail: 'Diagnosis does not match the coverage criteria.' },
        { ruleCode: 'TREATMENT_HISTORY_REQ', result: 'FAIL', detail: 'Prior treatment history is not documented.' },
      ],
      explainability: {
        sources: ['PA-DEMO-003/clinical-note.pdf'],
        rationale: 'Coverage policy requires documented diagnosis and treatment history not present in current records.',
      },
      sourceReferences: ['page-1', 'page-2'],
    },
    recommendation: {
      type: 'REJECT_RECOMMENDATION',
      confidence: 0.93,
      rationale: 'Insufficient evidence to support coverage under current plan policy and treatment history requirements.',
    },
    reviewerDecision: {
      decision: 'REJECTED',
      rationale: 'The human reviewer confirms the available data does not satisfy plan criteria and denies the request.',
    },
    notification: {
      type: 'STATUS_UPDATE',
      channel: 'EMAIL',
      status: 'SENT',
      subject: 'Prior Authorization Decision',
      message: 'Your request has been denied based on policy criteria and available documentation.',
    },
    audit: {
      action: 'PRIOR_AUTHORIZATION_CREATED',
      entityType: 'PriorAuthorization',
      entityId: 'PA-DEMO-003',
      correlationId: 'corr-pa-demo-003-01',
      metadata: { scenario: 'reject', workflow: 'denial' },
    },
  },
] as const;

function getDate(offsetDays: number, hour = 9, minute = 0) {
  const base = new Date('2026-08-01T00:00:00.000Z');
  base.setUTCDate(base.getUTCDate() + offsetDays);
  base.setUTCHours(hour, minute, 0, 0);
  return base;
}

function hasDomainModel(prismaClient: any, modelName: string): boolean {
  // First try runtime Prisma client (may be out-of-date if client wasn't generated)
  if (prismaClient && typeof prismaClient === 'object') {
    const camel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    if (prismaClient[camel] || prismaClient[modelName.toLowerCase()]) {
      return true;
    }
  }

  // Fall back to checking the prisma schema file directly to avoid false-negatives
  try {
    const schemaPath = path.resolve(__dirname, 'schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf8');
    const re = new RegExp(`model\\s+${modelName}\\b`, 'm');
    return re.test(content);
  } catch (e) {
    return false;
  }
}

async function upsertRole(prismaClient: any, name: string) {
  return prismaClient.role.upsert({
    where: { name },
    update: {},
    create: {
      name,
      createdAt: getDate(0),
      updatedAt: getDate(0),
    },
  });
}

async function upsertUser(prismaClient: any, input: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleName: string;
  providerId?: string | null;
}) {
  return prismaClient.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: (await prismaClient.role.findUnique({ where: { name: input.roleName } })).id,
      providerId: input.providerId ?? null,
      isActive: true,
      updatedAt: getDate(0),
    },
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: (await prismaClient.role.findUnique({ where: { name: input.roleName } })).id,
      providerId: input.providerId ?? null,
      isActive: true,
      createdAt: getDate(0),
      updatedAt: getDate(0),
    },
  });
}

async function seed() {
  const prismaAny = prisma as any;

  const missingModels = REQUIRED_MODELS.filter((model) => !hasDomainModel(prismaAny, model));
  if (missingModels.length > 0) {
    console.log(`Seed skipped: schema is not yet using the SmartPrior domain model set (missing: ${missingModels.join(', ')}).`);
    return;
  }

  // Ensure the generated Prisma client exposes the model accessors.
  
  const missingClientModels = REQUIRED_MODELS.filter((model) => {
    const camel = model.charAt(0).toLowerCase() + model.slice(1);
    return !Boolean(prismaAny[camel] || prismaAny[model.toLowerCase()]);
  });
  if (missingClientModels.length > 0) {
    console.log(`Seed aborted: Prisma client is missing model accessors (missing: ${missingClientModels.join(', ')}). Run 'npx prisma generate' and retry.`);
    return;
  }

  const roleByName = new Map<string, any>();
  for (const roleName of ['ADMIN', 'PROVIDER', 'REVIEWER'] as const) {
    const role = await upsertRole(prismaAny, roleName);
    roleByName.set(roleName, role);
  }

  let provider = await prismaAny.provider.findFirst({ where: { npi: 'DEMO-NPI-0001' } });
  if (!provider) {
    provider = await prismaAny.provider.create({
      data: {
        name: 'North Harbor Family Clinic',
        npi: 'DEMO-NPI-0001',
        taxId: '12-3456789',
        contactEmail: 'admin@northharbor-demo.local',
        phone: '+1-555-010-1041',
        addressLine1: '1200 Harbor View Drive',
        addressLine2: 'Suite 110',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'US',
        isActive: true,
        createdAt: getDate(0),
        updatedAt: getDate(0),
      },
    });
  }

  const adminUser = await upsertUser(prismaAny, {
    id: 'user-demo-admin',
    email: 'admin@smartprior-demo.local',
    firstName: 'Ava',
    lastName: 'Admin',
    roleName: 'ADMIN',
  });

  const providerUser = await upsertUser(prismaAny, {
    id: 'user-demo-provider',
    email: 'provider@smartprior-demo.local',
    firstName: 'Lena',
    lastName: 'Provider',
    roleName: 'PROVIDER',
    providerId: provider.id,
  });

  const reviewerUser = await upsertUser(prismaAny, {
    id: 'user-demo-reviewer',
    email: 'reviewer@smartprior-demo.local',
    firstName: 'Milo',
    lastName: 'Reviewer',
    roleName: 'REVIEWER',
    providerId: provider.id,
  });

  const insuranceCompany = await prismaAny.insuranceCompany.upsert({
    where: { code: 'INS-DEMO-001' },
    update: {},
    create: {
      name: 'Summit Health Plan',
      code: 'INS-DEMO-001',
      phone: '+1-555-010-2020',
      website: 'https://summit-demo.example',
      isActive: true,
      createdAt: getDate(0),
      updatedAt: getDate(0),
    },
  });

  const insurancePlan = await prismaAny.insurancePlan.upsert({
    where: {
      insuranceCompanyId_planCode: {
        insuranceCompanyId: insuranceCompany.id,
        planCode: 'PLAN-DEMO-001',
      },
    },
    update: {},
    create: {
      insuranceCompanyId: insuranceCompany.id,
      name: 'Summit Essential PPO',
      planCode: 'PLAN-DEMO-001',
      coverageType: 'PPO',
      status: 'ACTIVE',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: new Date('2027-12-31T00:00:00.000Z'),
      isActive: true,
      createdAt: getDate(0),
      updatedAt: getDate(0),
    },
  });

  const ruleDefinitions = [
    {
      code: 'DIAGNOSIS_REQ',
      name: 'Diagnosis requirement',
      description: 'A documented diagnosis matching the requested service is required.',
      ruleType: 'diagnosis',
      criteria: { required: true, field: 'diagnosisCode' },
    },
    {
      code: 'PHYSICIAN_ORDER_REQ',
      name: 'Physician order requirement',
      description: 'A signed physician order or office note is required for the therapy start.',
      ruleType: 'order',
      criteria: { required: true, field: 'physicianOrder' },
    },
    {
      code: 'DOCUMENTATION_REQ',
      name: 'Required clinical documentation',
      description: 'Clinical documentation and treatment plan must be complete and current.',
      ruleType: 'documentation',
      criteria: { required: true, field: 'clinicalNote' },
    },
    {
      code: 'IMAGING_REQ',
      name: 'Required imaging evidence',
      description: 'Imaging or support evidence is required when indicated by the requested treatment.',
      ruleType: 'imaging',
      criteria: { required: true, field: 'imagingSummary' },
    },
    {
      code: 'TREATMENT_HISTORY_REQ',
      name: 'Treatment history requirement',
      description: 'Prior treatment history must be documented before approval.',
      ruleType: 'history',
      criteria: { required: true, field: 'treatmentHistory' },
    },
  ] as const;

  const createdRules: any[] = [];
  for (const rule of ruleDefinitions) {
    const createdRule = await prismaAny.insuranceRule.upsert({
      where: {
        insurancePlanId_code: {
          insurancePlanId: insurancePlan.id,
          code: rule.code,
        },
      },
      update: {},
      create: {
        insurancePlanId: insurancePlan.id,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        ruleType: rule.ruleType,
        criteria: rule.criteria,
        isActive: true,
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2027-12-31T00:00:00.000Z'),
        createdAt: getDate(0),
        updatedAt: getDate(0),
      },
    });
    createdRules.push(createdRule);
  }

  const scenarioPatients: Record<string, any> = {};
  for (const scenario of DEMO_SCENARIOS) {
    const patient = await prismaAny.patient.upsert({
      where: { memberId: scenario.patient.memberId },
      update: {},
      create: {
        firstName: scenario.patient.firstName,
        lastName: scenario.patient.lastName,
        dateOfBirth: new Date(scenario.patient.dateOfBirth),
        gender: scenario.patient.gender,
        mrn: scenario.patient.mrn,
        memberId: scenario.patient.memberId,
        email: `${scenario.patient.firstName.toLowerCase()}.${scenario.patient.lastName.toLowerCase()}@demo.local`,
        phone: `+1-555-010-${(scenario.patient.memberId.match(/\d+$/)?.[0] ?? '0000').padStart(4, '0')}`,
        isActive: true,
        createdAt: getDate(0),
        updatedAt: getDate(0),
      },
    });
    scenarioPatients[scenario.key] = patient;
  }

  const priorAuthMap: Record<string, any> = {};
  for (const [index, scenario] of DEMO_SCENARIOS.entries()) {
    const patient = scenarioPatients[scenario.key];
    const pa = await prismaAny.priorAuthorization.upsert({
      where: { providerId_externalReference: { providerId: provider.id, externalReference: scenario.externalReference } },
      update: {
        status: scenario.status,
        priority: scenario.priority,
        requestedProcedureCode: 'J0130',
        requestedProcedureName: 'Intravitreal Injection',
        diagnosisCode: 'H35.89',
        diagnosisDescription: 'Chronic retinal condition requiring specialist treatment',
        requestNotes: 'Synthetic prior auth scenario generated for demo environment.',
        submittedAt: getDate(index + 1, 8),
        decisionAt: getDate(index + 1, 11),
        updatedAt: getDate(index + 1, 11),
      },
      create: {
        patientId: patient.id,
        providerId: provider.id,
        insurancePlanId: insurancePlan.id,
        submittedById: providerUser.id,
        status: scenario.status,
        priority: scenario.priority,
        requestedProcedureCode: 'J0130',
        requestedProcedureName: 'Intravitreal Injection',
        diagnosisCode: 'H35.89',
        diagnosisDescription: 'Chronic retinal condition requiring specialist treatment',
        requestNotes: 'Synthetic prior auth scenario generated for demo environment.',
        externalReference: scenario.externalReference,
        submittedAt: getDate(index + 1, 8),
        decisionAt: getDate(index + 1, 11),
        createdAt: getDate(index + 1, 7),
        updatedAt: getDate(index + 1, 11),
      },
    });
    priorAuthMap[scenario.key] = pa;
  }

  const documentMap: Record<string, any> = {};
  for (const [index, scenario] of DEMO_SCENARIOS.entries()) {
    const pa = priorAuthMap[scenario.key];
    // Documents do not expose a convenient unique field besides the auto-generated id.
    // Use findFirst by priorAuthorizationId + storageReference to ensure idempotence.
    let document = await prismaAny.document.findFirst({ where: { priorAuthorizationId: pa.id, storageReference: scenario.document.storageReference } });
    if (!document) {
      document = await prismaAny.document.create({
        data: {
          priorAuthorizationId: pa.id,
          uploadedById: providerUser.id,
          documentType: scenario.document.documentType,
          originalFileName: scenario.document.filename,
          storageReference: scenario.document.storageReference,
          mimeType: 'application/pdf',
          fileSizeBytes: 1800000 + index * 200000,
          uploadStatus: scenario.document.uploadStatus,
          uploadedAt: getDate(index + 1, 8),
          createdAt: getDate(index + 1, 8),
          updatedAt: getDate(index + 1, 8),
        },
      });
    }
    documentMap[scenario.key] = document;
  }

  for (const [index, scenario] of DEMO_SCENARIOS.entries()) {
    const pa = priorAuthMap[scenario.key];
    const document = documentMap[scenario.key];

    // DocumentExtraction: ensure a single extraction per document using documentId
    let extraction = await prismaAny.documentExtraction.findFirst({ where: { documentId: document.id } });
    if (!extraction) {
      extraction = await prismaAny.documentExtraction.create({
        data: {
          documentId: document.id,
          status: 'COMPLETED',
          structuredData: {
            diagnosis: 'H35.89',
            procedureCode: 'J0130',
            source: 'synthetic-demo',
          },
          summary: scenario.ai.clinicalSummary,
          confidenceScore: scenario.ai.confidenceScore,
          missingDocuments: scenario.ai.missingDocuments,
          criteriaFindings: scenario.ai.criteriaFindings,
          explainability: scenario.ai.explainability,
          sourceReferences: scenario.ai.sourceReferences,
          createdAt: getDate(index + 1, 9),
          updatedAt: getDate(index + 1, 9),
        },
      });
    }

    // AIAnalysis: identify by priorAuthorizationId + modelProvider + modelVersion
    let aiAnalysis = await prismaAny.aIAnalysis.findFirst({ where: { priorAuthorizationId: pa.id, modelProvider: 'synthetic-demo-vision-model', modelVersion: 'v1.0-demo' } });
    if (!aiAnalysis) {
      aiAnalysis = await prismaAny.aIAnalysis.create({
        data: {
          priorAuthorizationId: pa.id,
          analysisStatus: scenario.ai.analysisStatus,
          modelProvider: 'synthetic-demo-vision-model',
          modelVersion: 'v1.0-demo',
          processingTimeMs: 4300 + index * 500,
          confidenceScore: scenario.ai.confidenceScore,
          clinicalSummary: scenario.ai.clinicalSummary,
          missingDocuments: scenario.ai.missingDocuments,
          criteriaFindings: scenario.ai.criteriaFindings,
          explainability: scenario.ai.explainability,
          sourceReferences: scenario.ai.sourceReferences,
          startedAt: getDate(index + 1, 9),
          completedAt: getDate(index + 1, 9, 1),
          createdAt: getDate(index + 1, 9),
          updatedAt: getDate(index + 1, 9, 1),
        },
      });
    }

    // AIRecommendation: ensure single recommendation per analysis per run
    let aiRecommendation = await prismaAny.aIRecommendation.findFirst({ where: { priorAuthorizationId: pa.id, aiAnalysisId: aiAnalysis.id } });
    if (!aiRecommendation) {
      aiRecommendation = await prismaAny.aIRecommendation.create({
        data: {
          priorAuthorizationId: pa.id,
          aiAnalysisId: aiAnalysis.id,
          recommendation: scenario.recommendation.type,
          confidenceScore: scenario.recommendation.confidence,
          rationale: scenario.recommendation.rationale,
          generatedAt: getDate(index + 1, 9, 30),
          createdAt: getDate(index + 1, 9, 30),
          updatedAt: getDate(index + 1, 9, 30),
        },
      });
    }

    // ReviewerDecision: one decision per prior auth by reviewer
    let reviewerDecision = await prismaAny.reviewerDecision.findFirst({ where: { priorAuthorizationId: pa.id, reviewerId: reviewerUser.id } });
    if (!reviewerDecision) {
      reviewerDecision = await prismaAny.reviewerDecision.create({
        data: {
          priorAuthorizationId: pa.id,
          reviewerId: reviewerUser.id,
          decision: scenario.reviewerDecision.decision,
          rationale: scenario.reviewerDecision.rationale,
          reviewedAt: getDate(index + 1, 11),
          createdAt: getDate(index + 1, 11),
          updatedAt: getDate(index + 1, 11),
        },
      });
    }

    // Notification: avoid hard-coded id, use findFirst/create by recipient + priorAuthorization + type
    let notification = await prismaAny.notification.findFirst({ where: { recipientId: providerUser.id, priorAuthorizationId: pa.id, notificationType: scenario.notification.type } });
    if (!notification) {
      notification = await prismaAny.notification.create({
        data: {
          recipientId: providerUser.id,
          priorAuthorizationId: pa.id,
          notificationType: scenario.notification.type,
          channel: scenario.notification.channel,
          status: scenario.notification.status,
          subject: scenario.notification.subject,
          message: scenario.notification.message,
          sentAt: getDate(index + 1, 12),
          failureReason: null,
          createdAt: getDate(index + 1, 12),
          updatedAt: getDate(index + 1, 12),
        },
      });
    }

    const validationRules = createdRules.map((rule) => {
      const defaultResult =
        scenario.key === 'scenario-approve'
          ? 'PASS'
          : scenario.key === 'scenario-request-info'
            ? 'NEEDS_INFORMATION'
            : 'FAIL';

      const statusByCode: Record<string, string> = {
        DIAGNOSIS_REQ: scenario.key === 'scenario-reject' ? 'FAIL' : 'PASS',
        PHYSICIAN_ORDER_REQ: scenario.key === 'scenario-reject' ? 'FAIL' : 'PASS',
        DOCUMENTATION_REQ: scenario.key === 'scenario-request-info' ? 'NEEDS_INFORMATION' : scenario.key === 'scenario-reject' ? 'FAIL' : 'PASS',
        IMAGING_REQ: scenario.key === 'scenario-request-info' ? 'NEEDS_INFORMATION' : scenario.key === 'scenario-reject' ? 'FAIL' : 'PASS',
        TREATMENT_HISTORY_REQ: scenario.key === 'scenario-reject' ? 'FAIL' : 'PASS',
      };

      return {
        priorAuthorizationId: pa.id,
        insuranceRuleId: rule.id,
        result: statusByCode[rule.code] ?? defaultResult,
        details: `Synthetic validation result for ${rule.name}`,
        evidence: {
          scenario: scenario.key,
          ruleCode: rule.code,
          source: 'demo-seed',
        },
        evaluatedAt: getDate(index + 1, 10),
        createdAt: getDate(index + 1, 10),
        updatedAt: getDate(index + 1, 10),
      };
    });

    for (const vr of validationRules) {
      const existing = await prismaAny.ruleValidationResult.findFirst({ where: { priorAuthorizationId: vr.priorAuthorizationId, insuranceRuleId: vr.insuranceRuleId } });
      if (!existing) {
        await prismaAny.ruleValidationResult.create({ data: vr });
      }
    }

    const auditEntries = [
      {
        action: 'PRIOR_AUTHORIZATION_CREATED',
        entityType: 'PriorAuthorization',
        entityId: pa.id,
        correlationId: `${scenario.externalReference}-corr-01`,
        metadata: { createdBy: providerUser.email, scenario: scenario.key },
      },
      {
        action: 'DOCUMENT_UPLOADED',
        entityType: 'Document',
        entityId: document.id,
        correlationId: `${scenario.externalReference}-corr-02`,
        metadata: { filename: document.originalFileName, storageReference: document.storageReference },
      },
      {
        action: 'AI_ANALYSIS_COMPLETED',
        entityType: 'AIAnalysis',
        entityId: aiAnalysis.id,
        correlationId: `${scenario.externalReference}-corr-03`,
        metadata: { modelProvider: aiAnalysis.modelProvider, confidenceScore: aiAnalysis.confidenceScore },
      },
      {
        action: 'AI_RECOMMENDATION_GENERATED',
        entityType: 'AIRecommendation',
        entityId: aiRecommendation.id,
        correlationId: `${scenario.externalReference}-corr-04`,
        metadata: { recommendation: aiRecommendation.recommendation },
      },
      {
        action: 'REVIEWER_DECISION_SUBMITTED',
        entityType: 'ReviewerDecision',
        entityId: reviewerDecision.id,
        correlationId: `${scenario.externalReference}-corr-05`,
        metadata: { decision: reviewerDecision.decision },
      },
      {
        action: 'STATUS_CHANGED',
        entityType: 'PriorAuthorization',
        entityId: pa.id,
        correlationId: `${scenario.externalReference}-corr-06`,
        metadata: { previousStatus: 'SUBMITTED', nextStatus: pa.status },
      },
      {
        action: 'NOTIFICATION_SENT',
        entityType: 'Notification',
        entityId: notification.id,
        correlationId: `${scenario.externalReference}-corr-07`,
        metadata: { channel: notification.channel, status: notification.status },
      },
    ];

    for (const entry of auditEntries) {
      const existing = await prismaAny.auditLog.findFirst({
        where: {
          correlationId: entry.correlationId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
        },
      });

      if (!existing) {
        await prismaAny.auditLog.create({
          data: {
            actorId: reviewerUser.id,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            correlationId: entry.correlationId,
            metadata: entry.metadata,
            createdAt: getDate(index + 1, 13),
          },
        });
      }
    }
  }

  console.log('Synthetic SmartPrior demo data seeded successfully.');

  const summary = {
    roles: await prismaAny.role.count(),
    users: await prismaAny.user.count(),
    providers: await prismaAny.provider.count(),
    insuranceCompanies: await prismaAny.insuranceCompany.count(),
    insurancePlans: await prismaAny.insurancePlan.count(),
    insuranceRules: await prismaAny.insuranceRule.count(),
    patients: await prismaAny.patient.count(),
    priorAuthorizations: await prismaAny.priorAuthorization.count(),
    documents: await prismaAny.document.count(),
    documentExtractions: await prismaAny.documentExtraction.count(),
    ruleValidationResults: await prismaAny.ruleValidationResult.count(),
    aiAnalyses: await prismaAny.aIAnalysis.count(),
    aiRecommendations: await prismaAny.aIRecommendation.count(),
    reviewerDecisions: await prismaAny.reviewerDecision.count(),
    notifications: await prismaAny.notification.count(),
    auditLogs: await prismaAny.auditLog.count(),
  };

  console.log(JSON.stringify(summary, null, 2));
}

seed()
  .catch((error) => {
    console.error('Seed execution failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
