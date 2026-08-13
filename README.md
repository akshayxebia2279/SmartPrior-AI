# SmartPrior AI

> AI-assisted prior authorization platform providing clinical documentation extraction, criteria verification, and advisory recommendations with mandatory human reviewer guardrails.

---

## 📋 Problem Statement

Prior authorization delays cause care disruption, provider frustration, regulatory pressure, administrative cost, repeated submissions, and heavy reviewer workload. Manual review processes lead to inconsistent turn-around times and high operational overhead.

---

## 🎯 Project Objective

The MVP demonstrates how AI assists the prior authorization workflow by:
1. Processing clinical documents (PDF, images, EHR exports).
2. Summarizing clinical information.
3. Detecting missing documentation.
4. Validating authorization criteria against insurance guidelines.
5. Providing an advisory recommendation.
6. Providing confidence and explainability scores.
7. Supporting human reviewers.

> ⚠️ **CRITICAL AI GUARDRAIL**  
> AI MUST NEVER make final authorization decisions. AI provides clinical summaries, criteria verification, and advisory recommendations. Final decisions must always be made by an authorized human reviewer.

---

## 💻 Technology Stack

### Frontend
- **Framework:** React 18, Vite, TypeScript (Strict Mode)
- **UI Library:** Material UI (MUI v5)
- **Routing:** React Router v6
- **State & Data Fetching:** TanStack Query (React Query v5)
- **Forms & Validation:** React Hook Form, Zod

### Backend
- **Runtime & Server:** Node.js, Express, TypeScript (Strict Mode)
- **Architecture:** Controller → Service → Repository → Prisma → PostgreSQL
- **ORM & Database:** Prisma, PostgreSQL
- **Auth & Validation:** JWT, bcrypt, Zod
- **Logging & Errors:** Centralized Error Middleware, Request Logger

### Testing & DevOps
- **Testing:** Jest, Supertest
- **Containerization:** Docker, Docker Compose
- **CI/CD:** GitHub Actions workflow

---

## 📂 Repository Structure

```
SmartPrior-AI/
├── .github/
│   ├── workflows/             # GitHub Actions CI pipelines
│   └── prompts/               # Prompt templates & guidelines
├── docs/                      # Technical specifications & BRD/FRD/SRS
│   ├── BRD/
│   ├── FRD/
│   ├── SRS/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── ui/
│   ├── ai/
│   ├── testing/
│   ├── monitoring/
│   └── PROJECT-HANDOFF.md    # Initial foundation handoff report
├── frontend/                  # React + TypeScript + Vite Application
├── backend/                   # Express + TypeScript + Prisma Backend API
├── database/                  # Prisma schema & SQL migrations
├── tests/                     # Test configurations & documentation
├── scripts/                   # Helper dev scripts
├── docker/                    # Dockerfiles & docker-compose.yml
├── .env.example               # Safe environment variable template
├── .gitignore
├── package.json               # Root workspace orchestrator
└── README.md
```

---

## 🚀 Local Setup Instructions

### Prerequisites
- **Node.js**: v20+
- **npm**: v10+
- **Docker & Docker Compose** (Optional, for local PostgreSQL container)

### Environment Configuration
Copy the `.env.example` file to create your local `.env`:
```bash
cp .env.example .env
```

---

## 🏃 Running the Application

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Backend Development Server
```bash
npm run dev:backend
```
Backend API listens at `http://localhost:4000/api/v1/health`.

### 3. Start Frontend Development Server
```bash
npm run dev:frontend
```
Frontend shell opens at `http://localhost:3000`.

### 4. Run via Docker Compose (Local Database + Services)
```bash
docker-compose -f docker/docker-compose.yml up -d
```

---

## 🧪 Testing & Validation Commands

```bash
# Run unit & integration tests across workspaces
npm run test

# Run TypeScript type checking
npm run type-check

# Run ESLint across codebases
npm run lint

# Validate Prisma schema
npm run prisma:validate

# Build frontend & backend for production
npm run build
```

---

## 📊 Current Implementation Status

| Component | Status | Details |
|---|---|---|
| Initial Foundation | ✅ Complete | Directory structure, workspace configs, Express backend, React shell |
| Health Check API | ✅ Complete | `GET /api/v1/health` returning 200 OK |
| Prisma / DB Setup | ✅ Complete | Prisma schema setup & verification |
| Docker & CI/CD | ✅ Complete | Multi-stage Dockerfiles & GitHub Actions CI |
| Prior Auth Workflows | ⏳ Pending | Scheduled for future feature-by-feature iterations |
| AI Integration | ⏳ Pending | Scheduled for future feature-by-feature iterations |
