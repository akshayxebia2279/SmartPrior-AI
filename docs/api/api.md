# API Documentation Specification - SmartPrior-AI

## Base URL
`https://api.smartprior.ai/v1`

## Key Endpoints

### 1. Document Management
- **`POST /documents/upload`**
  - Uploads document file for analysis.
  - **Payload:** `multipart/form-data` containing `file`, `patient_id`, `provider_id`.
  - **Response:** `{ "document_id": "doc_123", "status": "queued" }`

- **`GET /documents/{document_id}`**
  - Fetches metadata and extraction results for a specific document.

### 2. Prior Authorization Evaluation
- **`POST /prior-auth/evaluate`**
  - Triggers AI policy engine evaluation against document ID.
  - **Response:** `{ "evaluation_id": "eval_456", "recommendation": "APPROVE", "confidence": 0.94 }`

- **`GET /prior-auth/queue`**
  - Retrieves pending requests for medical auditor review portal.

### 3. Decisions & Audit
- **`POST /prior-auth/{evaluation_id}/decision`**
  - Records auditor decision (`APPROVED`, `REJECTED`, `MORE_INFO_NEEDED`).
