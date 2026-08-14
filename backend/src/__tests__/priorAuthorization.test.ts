import request from 'supertest';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('Prior Authorization API', () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-secret-for-smartprior-auth-123456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.SMARTPRIOR_DEMO_PASSWORD = 'LocalTestPass123!';

  let app: any;
  const prisma = new PrismaClient();
  const demoProviderId = '44444444-4444-4444-4444-444444444444';
  const demoInsuranceCode = 'PRIOR-DEMO-001';
  const demoPlanCode = 'PRIOR-PLAN-001';
  const demoPatientMemberId = 'PRIOR-PATIENT-001';

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

  beforeAll(async () => {
    const appModule = await import('../app');
    app = appModule.createApp();

    // Ensure roles exist
    const adminRole = await seedRole('ADMIN');
    const providerRole = await seedRole('PROVIDER');
    const reviewerRole = await seedRole('REVIEWER');

    // Users (ensure passwordHash matches demo password)
    const demoPassword = process.env.SMARTPRIOR_DEMO_PASSWORD as string;
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    await prisma.user.upsert({
      where: { email: 'provider@smartprior-demo.local' },
      update: { roleId: providerRole.id, isActive: true, passwordHash },
      create: { email: 'provider@smartprior-demo.local', roleId: providerRole.id, isActive: true, passwordHash },
    });
    await prisma.user.upsert({
      where: { email: 'admin@smartprior-demo.local' },
      update: { roleId: adminRole.id, isActive: true, passwordHash },
      create: { email: 'admin@smartprior-demo.local', roleId: adminRole.id, isActive: true, passwordHash },
    });
    await prisma.user.upsert({
      where: { email: 'reviewer@smartprior-demo.local' },
      update: { roleId: reviewerRole.id, isActive: true, passwordHash },
      create: { email: 'reviewer@smartprior-demo.local', roleId: reviewerRole.id, isActive: true, passwordHash },
    });

    await prisma.provider.upsert({
      where: { id: demoProviderId },
      update: { name: 'Demo Provider Org' },
      create: { id: demoProviderId, name: 'Demo Provider Org' },
    });

    const company = await prisma.insuranceCompany.upsert({
      where: { code: demoInsuranceCode },
      update: { name: 'Demo Ins Co' },
      create: { name: 'Demo Ins Co', code: demoInsuranceCode },
    });

    await prisma.insurancePlan.upsert({
      where: {
        insuranceCompanyId_planCode: {
          insuranceCompanyId: company.id,
          planCode: demoPlanCode,
        },
      },
      update: { name: 'Demo Plan' },
      create: { insuranceCompanyId: company.id, name: 'Demo Plan', planCode: demoPlanCode },
    });

    await prisma.patient.upsert({
      where: { memberId: demoPatientMemberId },
      update: { firstName: 'Pat', lastName: 'Demo', email: 'patient@demo.local' },
      create: { firstName: 'Pat', lastName: 'Demo', email: 'patient@demo.local', memberId: demoPatientMemberId },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const loginAs = async (email: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: process.env.SMARTPRIOR_DEMO_PASSWORD });
    return res.body.accessToken;
  };

  const getProvider = async () => prisma.provider.findUnique({ where: { id: demoProviderId } });
  const getPatient = async () => prisma.patient.findUnique({ where: { memberId: demoPatientMemberId } });
  const getPlan = async () => {
    const company = await prisma.insuranceCompany.findUnique({ where: { code: demoInsuranceCode } });
    return prisma.insurancePlan.findUnique({
      where: {
        insuranceCompanyId_planCode: {
          insuranceCompanyId: company!.id,
          planCode: demoPlanCode,
        },
      },
    });
  };

  it('rejects unauthenticated access to list', async () => {
    const res = await request(app).get('/api/v1/prior-authorizations');
    expect(res.status).toBe(401);
  });

  it('creates a prior authorization successfully', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const res = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, requestedProcedureCode: 'ABC123' });

    expect(res.status).toBe(201);
    expect(res.body.priorAuthorization).toBeDefined();
    expect(res.body.priorAuthorization.requestedProcedureCode).toBe('ABC123');
    expect(res.body.priorAuthorization.patientId).toBe(patient!.id);
    expect(res.body.priorAuthorization.status).toBe('DRAFT');
  });

  it('rejects provider create with non-draft status', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const res = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, status: 'APPROVED' });

    expect(res.status).toBe(403);
  });

  it('rejects create with missing fields', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const res = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown id', async () => {
    const token = await loginAs('admin@smartprior-demo.local');
    const res = await request(app).get('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('retrieves a prior authorization by id', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, requestedProcedureCode: 'GETBYID-1' });

    const id = createRes.body.priorAuthorization.id;

    const res = await request(app)
      .get(`/api/v1/prior-authorizations/${id}`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.priorAuthorization.id).toBe(id);
  });

  it('rejects reviewer create due to role restrictions', async () => {
    const token = await loginAs('reviewer@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const res = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id });

    expect(res.status).toBe(403);
  });

  it('lists with pagination', async () => {
    const token = await loginAs('admin@smartprior-demo.local');
    const res = await request(app).get('/api/v1/prior-authorizations?page=1&pageSize=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.page).toBe(1);
  });

  it('updates status by reviewer/admin', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const adminToken = await loginAs('admin@smartprior-demo.local');

    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id });

    const id = createRes.body.priorAuthorization.id;

    // Provider can submit
    const submitRes = await request(app)
      .patch(`/api/v1/prior-authorizations/${id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'SUBMITTED' });
    expect(submitRes.status).toBe(200);

    // Reviewer can approve
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const approveRes = await request(app)
      .patch(`/api/v1/prior-authorizations/${id}/status`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ status: 'APPROVED' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.priorAuthorization.status).toBe('APPROVED');

    // Admin can still transition after review decision
    const underReviewRes = await request(app)
      .patch(`/api/v1/prior-authorizations/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'UNDER_REVIEW' });
    expect(underReviewRes.status).toBe(200);
    expect(underReviewRes.body.priorAuthorization.status).toBe('UNDER_REVIEW');
  });

  it('returns 400 for invalid status payload', async () => {
    const token = await loginAs('admin@smartprior-demo.local');
    const res = await request(app)
      .patch('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'NOT_A_REAL_STATUS' });

    expect(res.status).toBe(400);
  });

  it('prevents unauthorized status changes', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    // Create a draft
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id });

    const id = createRes.body.priorAuthorization.id;

    // Provider cannot directly approve
    const res = await request(app)
      .patch(`/api/v1/prior-authorizations/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('returns 409 when status is unchanged', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id });

    const id = createRes.body.priorAuthorization.id;
    const res = await request(app)
      .patch(`/api/v1/prior-authorizations/${id}/status`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ status: 'DRAFT' });

    expect(res.status).toBe(409);
  });

  it('reviewer can approve a prior authorization', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, requestedProcedureCode: 'DECISION-APPROVE' });

    const id = createRes.body.priorAuthorization.id;
    const decisionRes = await request(app)
      .post(`/api/v1/prior-authorizations/${id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'APPROVED', reason: 'Clinical criteria satisfied' });

    expect(decisionRes.status).toBe(200);
    expect(decisionRes.body.success).toBe(true);
    expect(decisionRes.body.data.priorAuthorizationId).toBe(id);
    expect(decisionRes.body.data.decision).toBe('APPROVED');
    expect(decisionRes.body.data.status).toBe('APPROVED');
    expect(decisionRes.body.data.reason).toBe('Clinical criteria satisfied');
  });

  it('reviewer can deny a prior authorization', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, requestedProcedureCode: 'DECISION-DENY' });

    const id = createRes.body.priorAuthorization.id;
    const decisionRes = await request(app)
      .post(`/api/v1/prior-authorizations/${id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'DENIED', reason: 'Clinical criteria not satisfied' });

    expect(decisionRes.status).toBe(200);
    expect(decisionRes.body.data.decision).toBe('REJECTED');
    expect(decisionRes.body.data.status).toBe('REJECTED');
    expect(decisionRes.body.data.reason).toBe('Clinical criteria not satisfied');
  });

  it('provider cannot make a reviewer decision', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, requestedProcedureCode: 'DECISION-FORBIDDEN' });

    const id = createRes.body.priorAuthorization.id;
    const decisionRes = await request(app)
      .post(`/api/v1/prior-authorizations/${id}/decision`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ decision: 'APPROVED', reason: 'Provider should not be allowed to decide' });

    expect(decisionRes.status).toBe(403);
  });

  it('rejects unauthenticated reviewer decision requests', async () => {
    const decisionRes = await request(app)
      .post('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000/decision')
      .send({ decision: 'APPROVED', reason: 'Missing auth header' });

    expect(decisionRes.status).toBe(401);
  });

  it('rejects invalid reviewer decisions', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, requestedProcedureCode: 'DECISION-INVALID' });

    const id = createRes.body.priorAuthorization.id;
    const decisionRes = await request(app)
      .post(`/api/v1/prior-authorizations/${id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'NOT_REAL', reason: 'Invalid decision value' });

    expect(decisionRes.status).toBe(400);
  });

  it('returns 404 for reviewer decision on a non-existent prior authorization', async () => {
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const decisionRes = await request(app)
      .post('/api/v1/prior-authorizations/00000000-0000-0000-0000-000000000000/decision')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'APPROVED', reason: 'Missing record' });

    expect(decisionRes.status).toBe(404);
  });

  it('persists reviewer decisions and updates prior authorization status', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');
    const provider = await getProvider();
    const patient = await getPatient();
    const plan = await getPlan();

    const createRes = await request(app)
      .post('/api/v1/prior-authorizations')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ patientId: patient!.id, providerId: provider!.id, insurancePlanId: plan!.id, requestedProcedureCode: 'DECISION-PERSIST' });

    const id = createRes.body.priorAuthorization.id;
    const decisionRes = await request(app)
      .post(`/api/v1/prior-authorizations/${id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'DENIED', reason: 'Insufficient supporting evidence' });

    expect(decisionRes.status).toBe(200);

    const persistedDecision = await prisma.reviewerDecision.findFirst({
      where: { priorAuthorizationId: id },
      orderBy: { reviewedAt: 'desc' },
    });
    const updatedPriorAuth = await prisma.priorAuthorization.findUnique({ where: { id } });

    expect(persistedDecision?.decision).toBe('REJECTED');
    expect(persistedDecision?.rationale).toBe('Insufficient supporting evidence');
    expect(updatedPriorAuth?.status).toBe('REJECTED');
    expect(updatedPriorAuth?.decisionAt).not.toBeNull();
  });
});
