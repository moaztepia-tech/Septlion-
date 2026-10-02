ALTER TABLE "QualifiedRequirement" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "QualifiedRequirement_organizationId_updatedAt_idx" ON "QualifiedRequirement"("organizationId","updatedAt");
