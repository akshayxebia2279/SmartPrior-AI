// Setup file run before tests to provide deterministic test-only env vars
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
// Ensure a deterministic, test-only secret with minimum length 32
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-secret-for-smartprior-tests-00000000';
process.env.SMARTPRIOR_DEMO_PASSWORD = process.env.SMARTPRIOR_DEMO_PASSWORD || 'LocalTestPass123!';

jest.setTimeout(15000);
