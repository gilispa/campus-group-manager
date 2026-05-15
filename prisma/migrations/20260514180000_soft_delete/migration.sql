ALTER TABLE "Student" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Group" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Category" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Role" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Career" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "PrepaProgram" ADD COLUMN "deletedAt" DATETIME;

CREATE INDEX "Student_deletedAt_idx" ON "Student"("deletedAt");
CREATE INDEX "Group_deletedAt_idx" ON "Group"("deletedAt");
