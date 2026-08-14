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

    // Provider org (find or create)
    let provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    if (!provider) {
      provider = await prisma.provider.create({ data: { name: 'Demo Provider Org' } });
    }

    // Insurance company and plan (find or create)
    let company = await prisma.insuranceCompany.findFirst({ where: { code: 'DEMO' } });
    if (!company) {
      company = await prisma.insuranceCompany.create({ data: { name: 'Demo Ins Co', code: 'DEMO' } });
    }

    let plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });
    if (!plan) {
      plan = await prisma.insurancePlan.create({ data: { insuranceCompanyId: company.id, name: 'Demo Plan', planCode: 'DEMO-PLAN' } });
    }

    // Patient (find or create)
    let patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    if (!patient) {
      patient = await prisma.patient.create({ data: { firstName: 'Pat', lastName: 'Demo', email: 'patient@demo.local' } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const loginAs = async (email: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: process.env.SMARTPRIOR_DEMO_PASSWORD });
    return res.body.accessToken;
  };

  it('rejects unauthenticated access to list', async () => {
    const res = await request(app).get('/api/v1/prior-authorizations');
    expect(res.status).toBe(401);
  });

  it('creates a prior authorization successfully', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

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
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

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
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

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
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

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

    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

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
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

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
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

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
});
