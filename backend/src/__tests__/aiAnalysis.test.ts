import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';

describe('AI Analysis API', () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-secret-for-smartprior-auth-123456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.SMARTPRIOR_DEMO_PASSWORD = 'LocalTestPass123!';
  process.env.AI_PROVIDER = 'local';

  let app: any;
  const prisma = new PrismaClient();
  const demoPassword = process.env.SMARTPRIOR_DEMO_PASSWORD as string;

  const demoProviderId = '33333333-3333-3333-3333-333333333333';
  const demoInsuranceCode = 'AI-DEMO-001';
  const demoPlanCode = 'AI-PLAN-001';
  const demoPatientMemberId = 'AI-PATIENT-001';

  const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const seedRole = async (name: 'ADMIN' | 'PROVIDER' | 'REVIEWER') => {
    try {
      return await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const role = await prisma.role.findUnique({ where: { name } });
        if (role) {
          return role;
        }
        throw new Error(`Role ${name} was created concurrently but could not be loaded.`);
      }

      throw error;
    }
  };

  const seedSharedData = async () => {
    const adminRole = await seedRole('ADMIN');
    const providerRole = await seedRole('PROVIDER');
    const reviewerRole = await seedRole('REVIEWER');

    const passwordHash = await bcrypt.hash(demoPassword, 10);

    await prisma.user.upsert({
      where: { email: 'admin@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Ava', lastName: 'Admin', roleId: adminRole.id, isActive: true },
      create: { email: 'admin@smartprior-demo.local', passwordHash, firstName: 'Ava', lastName: 'Admin', roleId: adminRole.id, isActive: true },
    });

    const provider = await prisma.provider.upsert({
      where: { id: demoProviderId },
      update: { name: 'AI Demo Provider Org' },
      create: { id: demoProviderId, name: 'AI Demo Provider Org' },
    });

    await prisma.user.upsert({
      where: { email: 'provider@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Lena', lastName: 'Provider', roleId: providerRole.id, providerId: provider.id, isActive: true },
      create: { email: 'provider@smartprior-demo.local', passwordHash, firstName: 'Lena', lastName: 'Provider', roleId: providerRole.id, providerId: provider.id, isActive: true },
    });

    await prisma.user.upsert({
      where: { email: 'reviewer@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Milo', lastName: 'Reviewer', roleId: reviewerRole.id, isActive: true },
      create: { email: 'reviewer@smartprior-demo.local', passwordHash, firstName: 'Milo', lastName: 'Reviewer', roleId: reviewerRole.id, isActive: true },
    });

    const company = await prisma.insuranceCompany.upsert({
      where: { code: demoInsuranceCode },
      update: { name: 'AI Demo Insurance' },
      create: { code: demoInsuranceCode, name: 'AI Demo Insurance' },
    });

    const plan = await prisma.insurancePlan.upsert({
      where: {
        insuranceCompanyId_planCode: {
          insuranceCompanyId: company.id,
          planCode: demoPlanCode,
        },
      },
      update: { name: 'AI Demo Plan' },
      create: {
        insuranceCompanyId: company.id,
        name: 'AI Demo Plan',
        planCode: demoPlanCode,
      },
    });

    await prisma.patient.upsert({
      where: { memberId: demoPatientMemberId },
      update: { firstName: 'Pat', lastName: 'Demo', email: 'ai-patient@demo.local' },
      create: { firstName: 'Pat', lastName: 'Demo', email: 'ai-patient@demo.local', memberId: demoPatientMemberId },
    });

    const rules = [
      { code: 'DIAGNOSIS_REQ', name: 'Diagnosis requirement', ruleType: 'diagnosis', criteria: { required: true, field: 'diagnosisCode' } },
      { code: 'DOCUMENTATION_REQ', name: 'Required clinical documentation', ruleType: 'documentation', criteria: { required: true, field: 'clinicalNote' } },
    ] as const;

    for (const rule of rules) {
      await prisma.insuranceRule.upsert({
        where: {
          insurancePlanId_code: {
            insurancePlanId: plan.id,
            code: rule.code,
          },
        },
        update: { name: rule.name, ruleType: rule.ruleType, criteria: rule.criteria, isActive: true },
        create: {
          insurancePlanId: plan.id,
          code: rule.code,
          name: rule.name,
          description: `${rule.name} for AI analysis test coverage`,
          ruleType: rule.ruleType,
          criteria: rule.criteria,
          isActive: true,
        },
      });
    }
  };

  const loginAs = async (email: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: demoPassword });
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
        requestedProcedureCode: 'A1000',
        requestedProcedureName: 'Retinal Procedure',
        diagnosisCode: diagnosisCode ?? null,
        externalReference: `AI-${reference}-${uniqueSuffix()}`,
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
        originalFileName: `ai-${uniqueSuffix()}.pdf`,
        storageReference: `local://uploads/ai-${uniqueSuffix()}.pdf`,
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
        summary: 'Deterministic extraction fixture for AI analysis tests',
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

  it('rejects unauthenticated analysis requests', async () => {
    const response = await request(app).post('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000/analysis');
    expect(response.status).toBe(401);
  });

  it('rejects forbidden role access for analysis endpoint', async () => {
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const pa = await createPriorAuthorization('FORBIDDEN', 'H35.89');

    const response = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/analysis`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(response.status).toBe(403);
  });

  it('returns 404 for nonexistent prior authorization', async () => {
    const token = await loginAs('provider@smartprior-demo.local');

    const response = await request(app)
      .post('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000/analysis')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('persists an approval-oriented AI analysis when evidence is complete', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const pa = await createPriorAuthorization('PASS', 'H35.89');

    await attachCompletedExtraction(pa.id, {
      clinicalNote: 'Clinical note confirms diagnosis and treatment plan',
    });

    await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${token}`);

    const response = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/analysis`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.analysis.analysisStatus).toBe('COMPLETED');
    expect(response.body.recommendation.recommendation).toBe('APPROVE_RECOMMENDATION');
    expect(response.body.analysis.clinicalSummary).toContain(pa.id);

    const persistedRecommendation = await prisma.aIRecommendation.findFirst({
      where: { priorAuthorizationId: pa.id },
      orderBy: { generatedAt: 'desc' },
    });
    expect(persistedRecommendation?.recommendation).toBe('APPROVE_RECOMMENDATION');
  });

  it('returns request-information recommendation when required evidence is missing', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const pa = await createPriorAuthorization('MISSING', null);

    await attachCompletedExtraction(pa.id, {
      noteOnly: 'This extraction intentionally omits required evidence fields',
    });

    await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${token}`);

    const response = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/analysis`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.recommendation.recommendation).toBe('REQUEST_INFORMATION');
    expect(response.body.analysis.missingDocuments.length).toBeGreaterThan(0);
  });

  it('allows reviewer to read the latest persisted AI analysis', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const pa = await createPriorAuthorization('READ', 'H35.89');

    await attachCompletedExtraction(pa.id, {
      clinicalNote: 'Clinical evidence is present for reviewer readback',
    });

    await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/evaluate`)
      .set('Authorization', `Bearer ${providerToken}`);

    const analyzeResponse = await request(app)
      .post(`/api/v1/prior-authorizations/${pa.id}/analysis`)
      .set('Authorization', `Bearer ${providerToken}`);
    expect(analyzeResponse.status).toBe(200);

    const getResponse = await request(app)
      .get(`/api/v1/prior-authorizations/${pa.id}/analysis`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.analysis.id).toBe(analyzeResponse.body.analysis.id);
    expect(getResponse.body.recommendation).toBeTruthy();
  });
});