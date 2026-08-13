# Testing Foundation - SmartPrior AI

This directory documents the testing suite for the SmartPrior AI project.

## Test Suites

### Backend Unit & Integration Tests (Jest + Supertest)
Located in `backend/src/__tests__/`.
- Validates API routes (`GET /api/v1/health`), middleware, services, and repositories.

Run backend tests:
```bash
npm run test --workspace=backend
```

### Frontend Tests
Located in `frontend/`.
- Configured for component rendering and unit validation.

Run frontend tests:
```bash
npm run test --workspace=frontend
```
