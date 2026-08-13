SmartPrior AI

Frontend:
React + TypeScript + Vite + Material UI

Backend:
Node.js + Express + TypeScript

Database:
PostgreSQL + Prisma

Architecture:
Controller → Service → Repository → Database

Roles:
PROVIDER
REVIEWER
ADMIN

AI:
AI is advisory only.
AI must never make the final authorization decision.

Testing:
Jest
Supertest
Playwright

Code quality:
TypeScript strict
ESLint
Prettier

Security:
JWT
bcrypt
RBAC
No secrets in source code

Rules:

- Reuse existing architecture.
- Do not modify unrelated files.
- Do not introduce unnecessary dependencies.
- Every feature must have tests.
- Do not rebuild existing functionality.
