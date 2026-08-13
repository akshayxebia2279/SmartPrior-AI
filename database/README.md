# Database Management - SmartPrior AI

This directory manages database migrations, seeds, and SQL utilities for SmartPrior AI.

## Database Setup & ORM
- **Database:** PostgreSQL
- **ORM:** Prisma

## Key Commands (Run from `backend/` or root)
```bash
# Generate Prisma client
npm run prisma:generate

# Validate Prisma schema
npm run prisma:validate

# Apply migrations (when database is running)
npx prisma migrate dev --name init
```
