/*
  Warnings:

  - You are about to drop the `health_checks` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'PROVIDER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "PriorAuthorizationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REQUEST_INFORMATION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CLINICAL_NOTE', 'LAB_RESULT', 'IMAGING', 'PRESCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentUploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentExtractionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIAnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AIRecommendationType" AS ENUM ('APPROVE_RECOMMENDATION', 'REJECT_RECOMMENDATION', 'REQUEST_INFORMATION', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "ReviewerDecisionType" AS ENUM ('APPROVED', 'REJECTED', 'REQUEST_INFORMATION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('STATUS_UPDATE', 'REMINDER', 'ALERT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "RuleValidationResultType" AS ENUM ('PENDING', 'PASS', 'FAIL', 'NEEDS_INFORMATION', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "InsurancePlanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PriorAuthorizationPriority" AS ENUM ('ROUTINE', 'URGENT', 'EXPEDITED');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('LOGIN', 'PRIOR_AUTHORIZATION_CREATED', 'DOCUMENT_UPLOADED', 'AI_ANALYSIS_COMPLETED', 'AI_RECOMMENDATION_GENERATED', 'REVIEWER_DECISION_SUBMITTED', 'STATUS_CHANGED', 'NOTIFICATION_SENT');

-- DropTable
DROP TABLE "health_checks";

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" "RoleName" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" UUID NOT NULL,
    "providerId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "npi" TEXT,
    "taxId" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'US',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "insurance_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_plans" (
    "id" UUID NOT NULL,
    "insuranceCompanyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "coverageType" TEXT,
    "status" "InsurancePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMPTZ,
    "effectiveTo" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "insurance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "mrn" TEXT,
    "memberId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prior_authorizations" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "insurancePlanId" UUID NOT NULL,
    "submittedById" UUID,
    "status" "PriorAuthorizationStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "PriorAuthorizationPriority" NOT NULL DEFAULT 'ROUTINE',
    "requestedProcedureCode" TEXT,
    "requestedProcedureName" TEXT,
    "diagnosisCode" TEXT,
    "diagnosisDescription" TEXT,
    "requestNotes" TEXT,
    "externalReference" TEXT,
    "submittedAt" TIMESTAMPTZ,
    "decisionAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "prior_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "priorAuthorizationId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageReference" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "uploadStatus" "DocumentUploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "status" "DocumentExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "structuredData" JSONB,
    "summary" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "missingDocuments" JSONB,
    "criteriaFindings" JSONB,
    "explainability" JSONB,
    "sourceReferences" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_rules" (
    "id" UUID NOT NULL,
    "insurancePlanId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" TEXT,
    "criteria" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMPTZ,
    "effectiveTo" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "insurance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_validation_results" (
    "id" UUID NOT NULL,
    "priorAuthorizationId" UUID NOT NULL,
    "insuranceRuleId" UUID NOT NULL,
    "result" "RuleValidationResultType" NOT NULL DEFAULT 'PENDING',
    "details" TEXT,
    "evidence" JSONB,
    "evaluatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rule_validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" UUID NOT NULL,
    "priorAuthorizationId" UUID NOT NULL,
    "analysisStatus" "AIAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "modelProvider" TEXT,
    "modelVersion" TEXT,
    "processingTimeMs" INTEGER,
    "confidenceScore" DOUBLE PRECISION,
    "clinicalSummary" TEXT,
    "missingDocuments" JSONB,
    "criteriaFindings" JSONB,
    "explainability" JSONB,
    "sourceReferences" JSONB,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL,
    "priorAuthorizationId" UUID NOT NULL,
    "aiAnalysisId" UUID NOT NULL,
    "recommendation" "AIRecommendationType" NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "rationale" TEXT,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer_decisions" (
    "id" UUID NOT NULL,
    "priorAuthorizationId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ReviewerDecisionType" NOT NULL,
    "rationale" TEXT,
    "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reviewer_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "priorAuthorizationId" UUID,
    "notificationType" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT,
    "message" TEXT,
    "sentAt" TIMESTAMPTZ,
    "failureReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" "AuditActionType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "users_providerId_idx" ON "users"("providerId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "providers_name_idx" ON "providers"("name");

-- CreateIndex
CREATE INDEX "providers_npi_idx" ON "providers"("npi");

-- CreateIndex
CREATE INDEX "providers_isActive_idx" ON "providers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_companies_code_key" ON "insurance_companies"("code");

-- CreateIndex
CREATE INDEX "insurance_companies_name_idx" ON "insurance_companies"("name");

-- CreateIndex
CREATE INDEX "insurance_companies_isActive_idx" ON "insurance_companies"("isActive");

-- CreateIndex
CREATE INDEX "insurance_plans_insuranceCompanyId_isActive_idx" ON "insurance_plans"("insuranceCompanyId", "isActive");

-- CreateIndex
CREATE INDEX "insurance_plans_planCode_idx" ON "insurance_plans"("planCode");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_plans_insuranceCompanyId_planCode_key" ON "insurance_plans"("insuranceCompanyId", "planCode");

-- CreateIndex
CREATE UNIQUE INDEX "patients_mrn_key" ON "patients"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "patients_memberId_key" ON "patients"("memberId");

-- CreateIndex
CREATE INDEX "patients_lastName_firstName_idx" ON "patients"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "patients_mrn_idx" ON "patients"("mrn");

-- CreateIndex
CREATE INDEX "patients_memberId_idx" ON "patients"("memberId");

-- CreateIndex
CREATE INDEX "prior_authorizations_patientId_status_idx" ON "prior_authorizations"("patientId", "status");

-- CreateIndex
CREATE INDEX "prior_authorizations_providerId_status_idx" ON "prior_authorizations"("providerId", "status");

-- CreateIndex
CREATE INDEX "prior_authorizations_insurancePlanId_status_idx" ON "prior_authorizations"("insurancePlanId", "status");

-- CreateIndex
CREATE INDEX "prior_authorizations_submittedById_idx" ON "prior_authorizations"("submittedById");

-- CreateIndex
CREATE INDEX "prior_authorizations_status_submittedAt_idx" ON "prior_authorizations"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "prior_authorizations_createdAt_idx" ON "prior_authorizations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prior_authorizations_providerId_externalReference_key" ON "prior_authorizations"("providerId", "externalReference");

-- CreateIndex
CREATE INDEX "documents_priorAuthorizationId_uploadStatus_idx" ON "documents"("priorAuthorizationId", "uploadStatus");

-- CreateIndex
CREATE INDEX "documents_uploadedById_uploadedAt_idx" ON "documents"("uploadedById", "uploadedAt");

-- CreateIndex
CREATE INDEX "documents_documentType_idx" ON "documents"("documentType");

-- CreateIndex
CREATE INDEX "document_extractions_documentId_status_idx" ON "document_extractions"("documentId", "status");

-- CreateIndex
CREATE INDEX "document_extractions_createdAt_idx" ON "document_extractions"("createdAt");

-- CreateIndex
CREATE INDEX "insurance_rules_insurancePlanId_isActive_idx" ON "insurance_rules"("insurancePlanId", "isActive");

-- CreateIndex
CREATE INDEX "insurance_rules_code_idx" ON "insurance_rules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_rules_insurancePlanId_code_key" ON "insurance_rules"("insurancePlanId", "code");

-- CreateIndex
CREATE INDEX "rule_validation_results_priorAuthorizationId_insuranceRuleI_idx" ON "rule_validation_results"("priorAuthorizationId", "insuranceRuleId");

-- CreateIndex
CREATE INDEX "rule_validation_results_result_idx" ON "rule_validation_results"("result");

-- CreateIndex
CREATE INDEX "ai_analyses_priorAuthorizationId_analysisStatus_idx" ON "ai_analyses"("priorAuthorizationId", "analysisStatus");

-- CreateIndex
CREATE INDEX "ai_analyses_modelProvider_modelVersion_idx" ON "ai_analyses"("modelProvider", "modelVersion");

-- CreateIndex
CREATE INDEX "ai_recommendations_priorAuthorizationId_generatedAt_idx" ON "ai_recommendations"("priorAuthorizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "ai_recommendations_aiAnalysisId_idx" ON "ai_recommendations"("aiAnalysisId");

-- CreateIndex
CREATE INDEX "reviewer_decisions_priorAuthorizationId_reviewedAt_idx" ON "reviewer_decisions"("priorAuthorizationId", "reviewedAt");

-- CreateIndex
CREATE INDEX "reviewer_decisions_reviewerId_decision_idx" ON "reviewer_decisions"("reviewerId", "decision");

-- CreateIndex
CREATE INDEX "notifications_recipientId_status_createdAt_idx" ON "notifications"("recipientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_priorAuthorizationId_status_idx" ON "notifications"("priorAuthorizationId", "status");

-- CreateIndex
CREATE INDEX "notifications_notificationType_channel_idx" ON "notifications"("notificationType", "channel");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_plans" ADD CONSTRAINT "insurance_plans_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "insurance_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_authorizations" ADD CONSTRAINT "prior_authorizations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_authorizations" ADD CONSTRAINT "prior_authorizations_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_authorizations" ADD CONSTRAINT "prior_authorizations_insurancePlanId_fkey" FOREIGN KEY ("insurancePlanId") REFERENCES "insurance_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prior_authorizations" ADD CONSTRAINT "prior_authorizations_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_priorAuthorizationId_fkey" FOREIGN KEY ("priorAuthorizationId") REFERENCES "prior_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_rules" ADD CONSTRAINT "insurance_rules_insurancePlanId_fkey" FOREIGN KEY ("insurancePlanId") REFERENCES "insurance_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_validation_results" ADD CONSTRAINT "rule_validation_results_priorAuthorizationId_fkey" FOREIGN KEY ("priorAuthorizationId") REFERENCES "prior_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_validation_results" ADD CONSTRAINT "rule_validation_results_insuranceRuleId_fkey" FOREIGN KEY ("insuranceRuleId") REFERENCES "insurance_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_priorAuthorizationId_fkey" FOREIGN KEY ("priorAuthorizationId") REFERENCES "prior_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_priorAuthorizationId_fkey" FOREIGN KEY ("priorAuthorizationId") REFERENCES "prior_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_aiAnalysisId_fkey" FOREIGN KEY ("aiAnalysisId") REFERENCES "ai_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_decisions" ADD CONSTRAINT "reviewer_decisions_priorAuthorizationId_fkey" FOREIGN KEY ("priorAuthorizationId") REFERENCES "prior_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_decisions" ADD CONSTRAINT "reviewer_decisions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_priorAuthorizationId_fkey" FOREIGN KEY ("priorAuthorizationId") REFERENCES "prior_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
