import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

describe('AUTH-001 authentication and RBAC foundation', () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-secret-for-smartprior-auth-123456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.SMARTPRIOR_DEMO_PASSWORD = 'LocalTestPass123!';

  let app: any;
  const prisma = new PrismaClient();
  const demoPassword = process.env.SMARTPRIOR_DEMO_PASSWORD as string;

  const setValidAuthEnv = () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test-secret-for-smartprior-auth-123456';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.SMARTPRIOR_DEMO_PASSWORD = 'LocalTestPass123!';
  };

  beforeAll(async () => {
    const appModule = await import('../app');
    app = appModule.createApp();
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN' },
    });

    const providerRole = await prisma.role.upsert({
      where: { name: 'PROVIDER' },
      update: {},
      create: { name: 'PROVIDER' },
    });

    const reviewerRole = await prisma.role.upsert({
      where: { name: 'REVIEWER' },
      update: {},
      create: { name: 'REVIEWER' },
    });

    const passwordHash = await bcrypt.hash(demoPassword, 10);

    await prisma.user.upsert({
      where: { email: 'admin@smartprior-demo.local' },
      update: {
        passwordHash,
        firstName: 'Ava',
        lastName: 'Admin',
        roleId: adminRole.id,
        isActive: true,
      },
      create: {
        email: 'admin@smartprior-demo.local',
        passwordHash,
        firstName: 'Ava',
        lastName: 'Admin',
        roleId: adminRole.id,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'provider@smartprior-demo.local' },
      update: {
        passwordHash,
        firstName: 'Lena',
        lastName: 'Provider',
        roleId: providerRole.id,
        isActive: true,
      },
      create: {
        email: 'provider@smartprior-demo.local',
        passwordHash,
        firstName: 'Lena',
        lastName: 'Provider',
        roleId: providerRole.id,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'reviewer@smartprior-demo.local' },
      update: {
        passwordHash,
        firstName: 'Milo',
        lastName: 'Reviewer',
        roleId: reviewerRole.id,
        isActive: true,
      },
      create: {
        email: 'reviewer@smartprior-demo.local',
        passwordHash,
        firstName: 'Milo',
        lastName: 'Reviewer',
        roleId: reviewerRole.id,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@smartprior-demo.local',
        password: demoPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user.email).toBe('admin@smartprior-demo.local');
    expect(response.body.user.role.name).toBe('ADMIN');
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('should reject login with invalid password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@smartprior-demo.local',
        password: 'wrong-password',
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('should reject login with unknown email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'unknown@smartprior-demo.local',
        password: demoPassword,
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('should not expose passwordHash in login response', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@smartprior-demo.local',
        password: demoPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('should reject /auth/me without token', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
  });

  it('should reject /auth/me with invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  it('should return current user with valid token', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'provider@smartprior-demo.local',
        password: demoPassword,
      });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('provider@smartprior-demo.local');
    expect(response.body.user.role.name).toBe('PROVIDER');
  });

  it('should allow ADMIN access to admin protected route', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@smartprior-demo.local',
        password: demoPassword,
      });

    const response = await request(app)
      .get('/api/v1/auth/admin-check')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.role).toBe('ADMIN');
  });

  it('should reject PROVIDER access to ADMIN-only route', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'provider@smartprior-demo.local',
        password: demoPassword,
      });

    const response = await request(app)
      .get('/api/v1/auth/admin-check')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(403);
  });

  it('should reject REVIEWER access to ADMIN-only route', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'reviewer@smartprior-demo.local',
        password: demoPassword,
      });

    const response = await request(app)
      .get('/api/v1/auth/admin-check')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(403);
  });

  it('should reject missing Authorization header', async () => {
    const response = await request(app).get('/api/v1/auth/admin-check');
    expect(response.status).toBe(401);
  });

  it('should reject malformed Bearer token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer');

    expect(response.status).toBe(401);
  });

  it('should reject expired JWTs', async () => {
    const expiredToken = jwt.sign(
      { userId: 'user-demo-admin', role: 'ADMIN' },
      process.env.JWT_ACCESS_SECRET as string,
      { expiresIn: -1, algorithm: 'HS256' }
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it('should reject JWTs signed with an unsupported algorithm', async () => {
    const unsupportedAlgToken = jwt.sign(
      { userId: 'user-demo-admin', role: 'ADMIN' },
      process.env.JWT_ACCESS_SECRET as string,
      { algorithm: 'HS384' }
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${unsupportedAlgToken}`);

    expect(response.status).toBe(401);
  });

  it('should document stateless logout behavior', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@smartprior-demo.local',
        password: demoPassword,
      });

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.loggedOut).toBe(true);
    expect(response.body.message).toContain('stateless JWTs');
  });

  it('should fail configuration when JWT_ACCESS_SECRET is missing', async () => {
    setValidAuthEnv();
    delete process.env.JWT_ACCESS_SECRET;
    jest.resetModules();

    expect(() => require('../config/env.config')).toThrow();
  });

  it('should fail configuration when JWT_ACCESS_SECRET is too short', async () => {
    setValidAuthEnv();
    process.env.JWT_ACCESS_SECRET = 'short';
    jest.resetModules();

    expect(() => require('../config/env.config')).toThrow();
  });
});
