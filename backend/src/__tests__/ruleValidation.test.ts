import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';

describe('Rule Validation API', () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-secret-for-smartprior-auth-123456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.SMARTPRIOR_DEMO_PASSWORD = 'LocalTestPass123!';

  let app: any;
  const prisma = new PrismaClient();
  const demoPassword = process.env.SMARTPRIOR_DEMO_PASSWORD as string;

  const demoProviderId = '22222222-2222-2222-2222-222222222222';
  const demoInsuranceCode = 'RULE-DEMO-001';
  const demoPlanCode = 'RULE-PLAN-001';
  const demoPatientMemberId = 'RULE-PATIENT-001';

  const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const seedSharedData = async () => {
    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const providerRole = await prisma.role.upsert({ where: { name: 'PROVIDER' }, update: {}, create: { name: 'PROVIDER' } });
    const reviewerRole = await prisma.role.upsert({ where: { name: 'REVIEWER' }, update: {}, create: { name: 'REVIEWER' } });

    const passwordHash = await bcrypt.hash(demoPassword, 10);

    await prisma.user.upsert({
      where: { email: 'admin@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Ava', lastName: 'Admin', roleId: adminRole.id, isActive: true },
      create: { email: 'admin@smartprior-demo.local', passwordHash, firstName: 'Ava', lastName: 'Admin', roleId: adminRole.id, isActive: true },
    });

    const provider = await prisma.provider.upsert({
      where: { id: demoProviderId },
      update: { name: 'Demo Provider Org' },
      create: { id: demoProviderId, name: 'Demo Provider Org' },
    });

    await prisma.user.upsert({
      where: { email: 'provider@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Lena', lastName: 'Provider', roleId: providerRole.id, providerId: demoProviderId, isActive: true },
      create: { email: 'provider@smartprior-demo.local', passwordHash, firstName: 'Lena', lastName: 'Provider', roleId: providerRole.id, providerId: demoProviderId, isActive: true },
    });

    await prisma.user.upsert({
      where: { email: 'reviewer@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Milo', lastName: 'Reviewer', roleId: reviewerRole.id, isActive: true },
      create: { email: 'reviewer@smartprior-demo.local', passwordHash, firstName: 'Milo', lastName: 'Reviewer', roleId: reviewerRole.id, isActive: true },
    });

    const company = await prisma.insuranceCompany.upsert({
      where: { code: demoInsuranceCode },
      update: { name: 'Rule Demo Insurance' },
      create: { code: demoInsuranceCode, name: 'Rule Demo Insurance' },
    });

    const plan = await prisma.insurancePlan.upsert({
      where: {
        insuranceCompanyId_planCode: {
          insuranceCompanyId: company.id,
          planCode: demoPlanCode,
        },
      },
      update: { name: 'Rule Demo Plan' },
      create: {
        insuranceCompanyId: company.id,
        name: 'Rule Demo Plan',
        planCode: demoPlanCode,
      },
    });

    await prisma.patient.upsert({
      where: { memberId: demoPatientMemberId },
      update: { firstName: 'Pat', lastName: 'Demo', email: 'rule-patient@demo.local' },
      create: {
        firstName: 'Pat',
        lastName: 'Demo',
        email: 'rule-patient@demo.local',
        memberId: demoPatientMemberId,
      },
    });

    const rules = [
      { code: 'DIAGNOSIS_REQ', name: 'Diagnosis requirement', ruleType: 'diagnosis', criteria: { required: true, field: 'diagnosisCode' } },
      { code: 'PHYSICIAN_ORDER_REQ', name: 'Physician order requirement', ruleType: 'order', criteria: { required: true, field: 'physicianOrder' } },
      { code: 'DOCUMENTATION_REQ', name: 'Required clinical documentation', ruleType: 'documentation', criteria: { required: true, field: 'clinicalNote' } },
      { code: 'IMAGING_REQ', name: 'Required imaging evidence', ruleType: 'imaging', criteria: { required: true, field: 'imagingSummary' } },
      { code: 'TREATMENT_HISTORY_REQ', name: 'Treatment history requirement', ruleType: 'history', criteria: { required: true, field: 'treatmentHistory' } },
      { code: 'OPTIONAL_CONTEXT_ONLY', name: 'Optional context rule', ruleType: 'optional', criteria: { required: false, field: 'optionalContext' } },
    ] as const;

    for (const rule of rules) {
      await prisma.insuranceRule.upsert({
        where: {
          insurancePlanId_code: {
            insurancePlanId: plan.id,
            code: rule.code,
          },
        },
        update: {
          name: rule.name,
          ruleType: rule.ruleType,
          criteria: rule.criteria,
          isActive: true,
        },
        create: {
          insurancePlanId: plan.id,
          code: rule.code,
          name: rule.name,
          description: `${rule.name} for deterministic test coverage`,
          ruleType: rule.ruleType,
          criteria: rule.criteria,
          isActive: true,
        },
      });
    }

    return { provider, plan };
  };

  const loginAs = async (email: string) => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: demoPassword });
    return res.body.accessToken;
  };

  const createPriorAuthorization = async (reference: string, diagnosisCode?: string | null) => {
    const patient = await prisma.patient.findUnique({ where: { memberId: demoPatientMemberId } });
    const company = await prisma.insuranceCompany.findUnique({ where: { code: demoInsuranceCode } });
    const plan = await prisma.insurancePlan.findUnique({
      where: {
        insuranceCompanyId_planCode: {
          insuranceCompanyId: company!.id,
          planCode: demoPlanCode,
        },
      },
    });

    return prisma.priorAuthorization.create({
      data: {
        patientId: patient!.id,
        providerId: demoProviderId,
        insurancePlanId: plan!.id,
        status: 'DRAFT',
        requestedProcedureCode: 'J0130',
        requestedProcedureName: 'Intravitreal Injection',
        diagnosisCode: diagnosisCode ?? null,
        externalReference: `RULE-${reference}-${uniqueSuffix()}`,
      },
    });
  };

  const attachCompletedExtraction = async (priorAuthorizationId: string, structuredData: Prisma.InputJsonObject) => {
    const providerUser = await prisma.user.findUnique({ where: { email: 'provider@smartprior-demo.local' } });

    const document = await prisma.document.create({
      data: {
        priorAuthorizationId,
        uploadedById: providerUser!.id,
        documentType: 'CLINICAL_NOTE',
        originalFileName: `rule-${uniqueSuffix()}.pdf`,
        storageReference: `local://uploads/rule-${uniqueSuffix()}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        uploadStatus: 'PROCESSED',
      },
    });

    await prisma.documentExtraction.create({
      data: {
        documentId: document.id,
        status: 'COMPLETED',
        structuredData,
        summary: 'Deterministic extraction fixture for rule validation tests',
      },
    });
  };

  beforeAll(async () => {
    const appModule = await import('../app');
    app = appModule.createApp();
    await seedSharedData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated evaluate request', async () => {
    const response = await request(app).post('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000/evaluate');
    expect(response.status).toBe(401);
  });

  it('rejects forbidden role access for evaluate endpoint', async () => {
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const pa = await createPriorAuthorization('FORBIDDEN', 'H35.89');

    const response = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(response.status).toBe(403);
  });

  it('returns 404 for nonexistent prior authorization', async () => {
    const token = await loginAs('provider@smartprior-demo.local');

    const response = await request(app)
      .post('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000/evaluate')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('evaluates all documented rules with PASS outcomes when required data is present', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const pa = await createPriorAuthorization('PASS', 'H35.89');

    await attachCompletedExtraction(pa.id, {
      physicianOrder: 'Signed physician order present',
      clinicalNote: 'Clinical note confirms diagnosis and care plan',
      imagingSummary: 'Imaging summary present',
      treatmentHistory: 'Previous conservative treatments documented',
    });

    const response = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.overallStatus).toBe('VALIDATION_PASSED');

    const byRule = Object.fromEntries(response.body.ruleResults.map((item: any) => [item.ruleIdentifier, item]));
    expect(byRule.DIAGNOSIS_REQ.outcome).toBe('PASS');
    expect(byRule.PHYSICIAN_ORDER_REQ.outcome).toBe('PASS');
    expect(byRule.DOCUMENTATION_REQ.outcome).toBe('PASS');
    expect(byRule.IMAGING_REQ.outcome).toBe('PASS');
    expect(byRule.TREATMENT_HISTORY_REQ.outcome).toBe('PASS');
    expect(byRule.OPTIONAL_CONTEXT_ONLY.outcome).toBe('NOT_APPLICABLE');
  });

  it('returns INSUFFICIENT_INFORMATION when required fields are missing', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const pa = await createPriorAuthorization('MISSING', null);

    await attachCompletedExtraction(pa.id, {
      clinicalNote: 'Only one supporting field is present',
    });

    const response = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.overallStatus).toBe('INSUFFICIENT_INFORMATION');
    expect(response.body.summary.failCount).toBeGreaterThan(0);

    const failed = response.body.ruleResults.filter((item: any) => item.outcome === 'FAIL');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((item: any) => String(item.reason).includes('missing'))).toBe(true);
  });

  it('evaluates multiple rules deterministically across repeated runs', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const pa = await createPriorAuthorization('DETERMINISTIC', 'H35.89');

    await attachCompletedExtraction(pa.id, {
      physicianOrder: 'Signed physician order present',
      clinicalNote: 'Clinical notes present',
      imagingSummary: 'Imaging summary present',
      treatmentHistory: 'Treatment history present',
    });

    const first = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${token}`);

    const second = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.overallStatus).toBe(first.body.overallStatus);

    const firstByRule = Object.fromEntries(first.body.ruleResults.map((item: any) => [item.ruleIdentifier, item.outcome]));
    const secondByRule = Object.fromEntries(second.body.ruleResults.map((item: any) => [item.ruleIdentifier, item.outcome]));
    expect(secondByRule).toEqual(firstByRule);
  });

  it('allows reviewer to read persisted evaluation results', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const pa = await createPriorAuthorization('READ', 'H35.89');

    await attachCompletedExtraction(pa.id, {
      physicianOrder: 'Signed physician order present',
      clinicalNote: 'Clinical notes present',
      imagingSummary: 'Imaging summary present',
      treatmentHistory: 'Treatment history present',
    });

    const evaluateResponse = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${providerToken}`);
    expect(evaluateResponse.status).toBe(200);

    const getResponse = await request(app)
      .get(`/api/v1/prior-authorizations/${pa.id}/evaluation`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.ruleResults.length).toBeGreaterThan(0);
  });
});
