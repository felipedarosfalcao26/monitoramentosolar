-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "MaintenanceTask" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "frequency" TEXT NOT NULL,
    "scheduledMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "requiredTechnicians" INTEGER NOT NULL DEFAULT 1,
    "assignedRole" TEXT,
    "assignedUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "userId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distanceFromEquipmentM" DOUBLE PRECISION,
    "distanceFlag" TEXT,
    "notes" TEXT,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceTask_plantId_idx" ON "MaintenanceTask"("plantId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_frequency_idx" ON "MaintenanceTask"("frequency");

-- CreateIndex
CREATE INDEX "MaintenanceTask_assignedUserId_idx" ON "MaintenanceTask"("assignedUserId");

-- CreateIndex
CREATE INDEX "MaintenanceExecution_status_idx" ON "MaintenanceExecution"("status");

-- CreateIndex
CREATE INDEX "MaintenanceExecution_dueDate_idx" ON "MaintenanceExecution"("dueDate");

-- CreateIndex
CREATE INDEX "MaintenanceExecution_userId_idx" ON "MaintenanceExecution"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceExecution_taskId_periodKey_key" ON "MaintenanceExecution"("taskId", "periodKey");

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceExecution" ADD CONSTRAINT "MaintenanceExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MaintenanceTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceExecution" ADD CONSTRAINT "MaintenanceExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
