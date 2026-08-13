# System Architecture - SmartPrior-AI

## 1. High-Level Architecture Overview
SmartPrior-AI follows a decoupled microservices / modular monolith architecture with async background processing workers.

```
[ Frontend Client (React/Next.js) ]
               │
               ▼
[ API Gateway / Backend Services (Node.js/Python) ]
         │          │                   │
         ▼          ▼                   ▼
  [ Database ]  [ Cache ]      [ Message Queue / Redis ]
                                        │
                                        ▼
                           [ AI Processing Worker ]
                                   │       │
                                   ▼       ▼
                            [ OCR Engine ] [ LLM / Vision Pipeline ]
```

## 2. Component Specification
- **Frontend App:** Single Page Application (SPA) built for fast document viewing, highlighting, and decision recording.
- **Backend API:** RESTful / GraphQL API service handling authentication, document orchestration, and status tracking.
- **AI Engine Worker:** Async queue consumer responsible for chunking documents, performing OCR, running entity extraction, and evaluating policy rules.
- **Storage Layer:** Relational DB (PostgreSQL) for relational data & metadata; Object Storage (S3 / Blob) for documents.
