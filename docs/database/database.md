# Database Schema Specification - SmartPrior-AI

## Entity Relationship Overview

### Core Tables

1. **`users`**

   - `id` (UUID, PK)
   - `email` (VARCHAR, Unique)
   - `role` (ENUM: admin, doctor, auditor)
   - `created_at` (TIMESTAMP)

2. **`documents`**

   - `id` (UUID, PK)
   - `patient_id` (VARCHAR)
   - `provider_id` (UUID, FK -> users.id)
   - `file_path` (VARCHAR)
   - `file_type` (VARCHAR)
   - `status` (ENUM: pending, processing, processed, failed)

3. **`extractions`**

   - `id` (UUID, PK)
   - `document_id` (UUID, FK -> documents.id)
   - `raw_text` (TEXT)
   - `extracted_entities` (JSONB)
   - `confidence_score` (FLOAT)

4. **`evaluations`**
   - `id` (UUID, PK)
   - `document_id` (UUID, FK -> documents.id)
   - `ai_recommendation` (VARCHAR)
   - `auditor_decision` (VARCHAR)
   - `auditor_comments` (TEXT)
   - `auditor_id` (UUID, FK -> users.id)
