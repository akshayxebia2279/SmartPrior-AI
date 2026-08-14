import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

describe('Document Management API', () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-secret-for-smartprior-auth-123456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.SMARTPRIOR_DEMO_PASSWORD = 'LocalTestPass123!';

  let app: any;
  const prisma = new PrismaClient();
  const demoPassword = process.env.SMARTPRIOR_DEMO_PASSWORD as string;

  beforeAll(async () => {
    const appModule = await import('../app');
    app = appModule.createApp();

    const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
    const providerRole = await prisma.role.upsert({ where: { name: 'PROVIDER' }, update: {}, create: { name: 'PROVIDER' } });
    const reviewerRole = await prisma.role.upsert({ where: { name: 'REVIEWER' }, update: {}, create: { name: 'REVIEWER' } });

    const passwordHash = await bcrypt.hash(demoPassword, 10);

    await prisma.user.upsert({
      where: { email: 'admin@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Ava', lastName: 'Admin', roleId: adminRole.id, isActive: true },
      create: { email: 'admin@smartprior-demo.local', passwordHash, firstName: 'Ava', lastName: 'Admin', roleId: adminRole.id, isActive: true },
    });

    await prisma.user.upsert({
      where: { email: 'provider@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Lena', lastName: 'Provider', roleId: providerRole.id, isActive: true },
      create: { email: 'provider@smartprior-demo.local', passwordHash, firstName: 'Lena', lastName: 'Provider', roleId: providerRole.id, isActive: true },
    });

    await prisma.user.upsert({
      where: { email: 'reviewer@smartprior-demo.local' },
      update: { passwordHash, firstName: 'Milo', lastName: 'Reviewer', roleId: reviewerRole.id, isActive: true },
      create: { email: 'reviewer@smartprior-demo.local', passwordHash, firstName: 'Milo', lastName: 'Reviewer', roleId: reviewerRole.id, isActive: true },
    });

    let provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    if (!provider) {
      provider = await prisma.provider.create({ data: { name: 'Demo Provider Org' } });
    }

    let company = await prisma.insuranceCompany.findFirst({ where: { code: 'DEMO' } });
    if (!company) {
      company = await prisma.insuranceCompany.create({ data: { name: 'Demo Ins Co', code: 'DEMO' } });
    }

    let plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });
    if (!plan) {
      plan = await prisma.insurancePlan.create({ data: { insuranceCompanyId: company.id, name: 'Demo Plan', planCode: 'DEMO-PLAN' } });
    }

    let patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    if (!patient) {
      patient = await prisma.patient.create({ data: { firstName: 'Pat', lastName: 'Demo', email: 'patient@demo.local' } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const loginAs = async (email: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: demoPassword });
    return res.body.accessToken;
  };

  it('rejects unauthenticated document upload', async () => {
    const response = await request(app).post('/api/v1/documents/upload');
    expect(response.status).toBe(401);
  });

  it('uploads a document and stores metadata for a prior authorization', async () => {
    const token = await loginAs('provider@smartprior-demo.local');
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

    const authorization = await prisma.priorAuthorization.create({
      data: {
        patientId: patient!.id,
        providerId: provider!.id,
        insurancePlanId: plan!.id,
        status: 'DRAFT',
        requestedProcedureCode: 'DOC-TEST-001',
      },
    });

    const response = await request(app)
      .post('/api/v1/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('priorAuthorizationId', authorization.id)
      .field('documentType', 'CLINICAL_NOTE')
      .attach('file', Buffer.from('%PDF-1.4\n...', 'utf8'), {
        filename: 'clinical-note.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    expect(response.body.document).toBeDefined();
    expect(response.body.document.priorAuthorizationId).toBe(authorization.id);
    expect(response.body.document.documentType).toBe('CLINICAL_NOTE');
    expect(response.body.document.uploadStatus).toBe('UPLOADED');
  });

  it('lists uploaded documents for a prior authorization', async () => {
    const token = await loginAs('admin@smartprior-demo.local');
    const provider = await prisma.provider.findFirst({ where: { name: 'Demo Provider Org' } });
    const patient = await prisma.patient.findFirst({ where: { email: 'patient@demo.local' } });
    const plan = await prisma.insurancePlan.findFirst({ where: { planCode: 'DEMO-PLAN' } });

    const authorization = await prisma.priorAuthorization.create({
      data: {
        patientId: patient!.id,
        providerId: provider!.id,
        insurancePlanId: plan!.id,
        status: 'DRAFT',
        requestedProcedureCode: 'DOC-TEST-002',
      },
    });

    await prisma.document.create({
      data: {
        priorAuthorizationId: authorization.id,
        uploadedById: (await prisma.user.findUnique({ where: { email: 'provider@smartprior-demo.local' } }))!.id,
        documentType: 'IMAGING',
        originalFileName: 'scan.tiff',
        storageReference: 'local://uploads/test-scan.tiff',
        mimeType: 'image/tiff',
        fileSizeBytes: 1024,
        uploadStatus: 'UPLOADED',
      },
    });

    const response = await request(app)
      .get(`/api/v1/prior-authorizations/${authorization.id}/documents`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toBeDefined();
    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });
});
