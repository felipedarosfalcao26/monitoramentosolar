-- AlterTable
ALTER TABLE "MaintenanceExecution" ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewStatus" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- AddForeignKey
ALTER TABLE "MaintenanceExecution" ADD CONSTRAINT "MaintenanceExecution_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
