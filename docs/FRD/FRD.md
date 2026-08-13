# Functional Requirements Document (FRD) - SmartPrior-AI

## 1. Document Management & Ingestion

- **FR-1.1:** System shall support uploading PDF, PNG, JPG, and TIFF medical documents.
- **FR-1.2:** System shall validate file sizes (up to 50MB per file) and file integrity upon upload.
- **FR-1.3:** System shall store raw uploaded documents in secure, encrypted cloud storage.

## 2. AI Document Processing & Extraction

- **FR-2.1:** System shall OCR and parse unstructured medical text from uploaded documents.
- **FR-2.2:** System shall extract key clinical entities including Patient ID, Provider Details, Diagnosis Codes (ICD-10), Procedure Codes (CPT), and Medication Names.
- **FR-2.3:** System shall evaluate extracted data against active insurance policy criteria and generate a Prior Authorization Score / Recommendation.

## 3. Reviewer Dashboard & Approval Workflow

- **FR-3.1:** System shall display a queue of pending prior authorization requests sorted by urgency / priority.
- **FR-3.2:** System shall render side-by-side view of original document and AI extracted data with confidence scores.
- **FR-3.3:** Reviewers shall be able to manual override AI extractions or recommendations with mandatory audit comments.

## 4. Notifications & Status Updates

- **FR-4.1:** System shall send real-time web and email notifications to providers on status changes (Approved, Needs Info, Rejected).
