-- CreateTable
CREATE TABLE "InspectionRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shift" TEXT,
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,0',
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionRoute_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "expectedTimeOfDay" TEXT,
    CONSTRAINT "RoutePoint_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "InspectionRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoutePoint_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "routeId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "plannedPoints" INTEGER NOT NULL DEFAULT 0,
    "visitedPoints" INTEGER NOT NULL DEFAULT 0,
    "completionPercent" REAL,
    "distanceMeters" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Round_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Round_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "InspectionRoute" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Occurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT,
    "equipmentId" TEXT,
    "plantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIA',
    "description" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "Occurrence_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Occurrence_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Occurrence_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Occurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "roundId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIA',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Alert_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Alert_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "roundId" TEXT,
    "qrToken" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "accuracyMeters" REAL,
    "deviceInfo" TEXT,
    "distanceFromEquipmentM" REAL,
    "distanceFlag" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "offlineCreatedAt" DATETIME,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scan_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scan_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scan_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scan" ("accuracyMeters", "createdAt", "deviceInfo", "distanceFlag", "distanceFromEquipmentM", "equipmentId", "id", "latitude", "longitude", "notes", "offlineCreatedAt", "photoUrl", "plantId", "qrToken", "scannedAt", "status", "syncedAt", "userId") SELECT "accuracyMeters", "createdAt", "deviceInfo", "distanceFlag", "distanceFromEquipmentM", "equipmentId", "id", "latitude", "longitude", "notes", "offlineCreatedAt", "photoUrl", "plantId", "qrToken", "scannedAt", "status", "syncedAt", "userId" FROM "Scan";
DROP TABLE "Scan";
ALTER TABLE "new_Scan" RENAME TO "Scan";
CREATE INDEX "Scan_plantId_scannedAt_idx" ON "Scan"("plantId", "scannedAt");
CREATE INDEX "Scan_userId_scannedAt_idx" ON "Scan"("userId", "scannedAt");
CREATE INDEX "Scan_equipmentId_idx" ON "Scan"("equipmentId");
CREATE INDEX "Scan_roundId_idx" ON "Scan"("roundId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InspectionRoute_plantId_idx" ON "InspectionRoute"("plantId");

-- CreateIndex
CREATE INDEX "RoutePoint_routeId_idx" ON "RoutePoint"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutePoint_routeId_equipmentId_key" ON "RoutePoint"("routeId", "equipmentId");

-- CreateIndex
CREATE INDEX "Round_plantId_startedAt_idx" ON "Round"("plantId", "startedAt");

-- CreateIndex
CREATE INDEX "Round_userId_startedAt_idx" ON "Round"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Occurrence_plantId_status_idx" ON "Occurrence"("plantId", "status");

-- CreateIndex
CREATE INDEX "Occurrence_equipmentId_idx" ON "Occurrence"("equipmentId");

-- CreateIndex
CREATE INDEX "Alert_plantId_status_idx" ON "Alert"("plantId", "status");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");
