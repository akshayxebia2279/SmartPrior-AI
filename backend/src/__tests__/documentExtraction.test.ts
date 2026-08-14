import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';

describe('Document Extraction API', () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-secret-for-smartprior-auth-123456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.SMARTPRIOR_DEMO_PASSWORD = 'LocalTestPass123!';

  let app: any;
  const prisma = new PrismaClient();
  const demoPassword = process.env.SMARTPRIOR_DEMO_PASSWORD as string;
  const demoProviderId = '11111111-1111-1111-1111-111111111111';
  const demoPatientMemberId = 'PATIENT-DEMO-001';

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
      }

      throw error;
    }
  };

  const seedReferenceData = async () => {
    const adminRole = await seedRole('ADMIN');
    const providerRole = await seedRole('PROVIDER');
    const reviewerRole = await seedRole('REVIEWER');

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

    const provider = await prisma.provider.upsert({
      where: { id: demoProviderId },
      update: { name: 'Demo Provider Org' },
      create: { id: demoProviderId, name: 'Demo Provider Org' },
    });

    const company = await prisma.insuranceCompany.upsert({
      where: { code: 'DEMO' },
      update: { name: 'Demo Ins Co' },
      create: { name: 'Demo Ins Co', code: 'DEMO' },
    });

    const plan = await prisma.insurancePlan.upsert({
      where: {
        insuranceCompanyId_planCode: {
          insuranceCompanyId: company.id,
          planCode: 'DEMO-PLAN',
        },
      },
      update: { name: 'Demo Plan' },
      create: { insuranceCompanyId: company.id, name: 'Demo Plan', planCode: 'DEMO-PLAN' },
    });

    await prisma.patient.upsert({
      where: { memberId: demoPatientMemberId },
      update: { firstName: 'Pat', lastName: 'Demo', email: 'patient@demo.local' },
      create: { firstName: 'Pat', lastName: 'Demo', email: 'patient@demo.local', memberId: demoPatientMemberId },
    });

    return { provider, company, plan };
  };

  const loginAs = async (email: string) => {
    const response = await request(app).post('/api/v1/auth/login').send({ email, password: demoPassword });
    return response.body.accessToken;
  };

  const createDraftAuthorization = async (reference: string) => {
    const provider = await prisma.provider.findUnique({ where: { id: demoProviderId } });
    const patient = await prisma.patient.findUnique({ where: { memberId: demoPatientMemberId } });
    const company = await prisma.insuranceCompany.findUnique({ where: { code: 'DEMO' } });
    const plan = await prisma.insurancePlan.findUnique({
      where: {
        insuranceCompanyId_planCode: {
          insuranceCompanyId: company!.id,
          planCode: 'DEMO-PLAN',
        },
      },
    });

    return prisma.priorAuthorization.create({
      data: {
        patientId: patient!.id,
        providerId: provider!.id,
        insurancePlanId: plan!.id,
        status: 'DRAFT',
        requestedProcedureCode: reference,
      },
    });
  };

  const createDocument = async (authorizationId: string, overrides?: Partial<{
    originalFileName: string;
    storageReference: string;
    uploadStatus: 'UPLOADED' | 'FAILED';
    documentType: 'CLINICAL_NOTE' | 'LAB_RESULT' | 'IMAGING' | 'PRESCRIPTION' | 'OTHER';
  }>) => {
    const provider = await prisma.user.findUnique({ where: { email: 'provider@smartprior-demo.local' } });

    return prisma.document.create({
      data: {
        priorAuthorizationId: authorizationId,
        uploadedById: provider!.id,
        documentType: overrides?.documentType || 'CLINICAL_NOTE',
        originalFileName: overrides?.originalFileName || `clinical-note-${uniqueSuffix()}.pdf`,
        storageReference: overrides?.storageReference || `local://uploads/${uniqueSuffix()}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        uploadStatus: overrides?.uploadStatus || 'UPLOADED',
      },
    });
  };

  const processDocument = async (token: string, documentId: string) => {
    return request(app)
      .post(`/api/v1/documents/${documentId}/extraction`)
      .set('Authorization', `Bearer ${token}`);
  };

  beforeAll(async () => {
    const appModule = await import('../app');
    app = appModule.createApp();
    await seedReferenceData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated extraction requests', async () => {
    const response = await request(app).post('/api/v1/documents/00000000-0000-0000-0000-000000000000/extraction');
    expect(response.status).toBe(401);
  });

  it('rejects unauthorized extraction requests', async () => {
    const authorization = await createDraftAuthorization(`UNAUTH-${uniqueSuffix()}`);
    const document = await createDocument(authorization.id);
    const reviewerToken = await loginAs('reviewer@smartprior-demo.local');

    const response = await processDocument(reviewerToken, document.id);
    expect(response.status).toBe(403);
  });

  it('returns 404 when the document does not exist', async () => {
    const providerToken = await loginAs('provider@smartprior-demo.local');

    const response = await processDocument(providerToken, '00000000-0000-0000-0000-000000000000');
    expect(response.status).toBe(404);
  });

  it('processes a document successfully', async () => {
    const authorization = await createDraftAuthorization(`SUCCESS-${uniqueSuffix()}`);
    const document = await createDocument(authorization.id);
    const providerToken = await loginAs('provider@smartprior-demo.local');

    const response = await processDocument(providerToken, document.id);

    expect(response.status).toBe(200);
    expect(response.body.document.uploadStatus).toBe('PROCESSED');
    expect(response.body.extraction.status).toBe('COMPLETED');
    expect(response.body.extraction.structuredData.documentId).toBe(document.id);
    expect(response.body.extraction.sourceReferences[0].storageReference).toBe(document.storageReference);
  });

  it('persists the processing state transition', async () => {
    const authorization = await createDraftAuthorization(`TRANSITION-${uniqueSuffix()}`);
    const document = await createDocument(authorization.id);
    const providerToken = await loginAs('provider@smartprior-demo.local');

    const before = await prisma.document.findUnique({ where: { id: document.id } });
    expect(before?.uploadStatus).toBe('UPLOADED');

    const response = await processDocument(providerToken, document.id);
    expect(response.status).toBe(200);

    const after = await prisma.document.findUnique({ where: { id: document.id } });
    const extraction = await prisma.documentExtraction.findFirst({
      where: { documentId: document.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(after?.uploadStatus).toBe('PROCESSED');
    expect(extraction?.status).toBe('COMPLETED');
  });

  it('returns extraction data through the document retrieval endpoint', async () => {
    const authorization = await createDraftAuthorization(`RETRIEVE-${uniqueSuffix()}`);
    const document = await createDocument(authorization.id);
    const providerToken = await loginAs('provider@smartprior-demo.local');
    const adminToken = await loginAs('admin@smartprior-demo.local');

    const processResponse = await processDocument(providerToken, document.id);
    expect(processResponse.status).toBe(200);

    const response = await request(app)
      .get(`/api/v1/documents/${document.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.document.extractions).toHaveLength(1);
    expect(response.body.document.extractions[0].status).toBe('COMPLETED');
    expect(response.body.document.extractions[0].structuredData.originalFileName).toContain('clinical-note');
  });

  it('records a failed extraction state', async () => {
    const authorization = await createDraftAuthorization(`FAIL-${uniqueSuffix()}`);
    const document = await createDocument(authorization.id, { originalFileName: 'force-fail.pdf' });
    const providerToken = await loginAs('provider@smartprior-demo.local');

    const response = await processDocument(providerToken, document.id);

    expect(response.status).toBe(200);
    expect(response.body.document.uploadStatus).toBe('FAILED');
    expect(response.body.extraction.status).toBe('FAILED');
    expect(response.body.extraction.summary).toContain('failed');
  });

  it('rejects duplicate processing requests', async () => {
    const authorization = await createDraftAuthorization(`DUP-${uniqueSuffix()}`);
    const document = await createDocument(authorization.id);
    const providerToken = await loginAs('provider@smartprior-demo.local');

    const firstResponse = await processDocument(providerToken, document.id);
    expect(firstResponse.status).toBe(200);

    const secondResponse = await processDocument(providerToken, document.id);
    expect(secondResponse.status).toBe(409);
  });

  it('does not expose raw filesystem paths in extraction responses', async () => {
    const authorization = await createDraftAuthorization(`PATH-${uniqueSuffix()}`);
    const document = await createDocument(authorization.id);
    const providerToken = await loginAs('provider@smartprior-demo.local');

    const response = await processDocument(providerToken, document.id);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toMatch(/[A-Za-z]:\\\\|\\\\|\/Users\/|\/var\/|\/tmp\/|\/home\//);
    expect(response.body.extraction.sourceReferences[0].storageReference).toBe(document.storageReference);
  });
});
