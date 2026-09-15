import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}

/**
 * Cross-plant executive rollup: activity trends, occurrence severity mix,
 * round quality, and per-plant comparison — everything the operational
 * dashboard doesn't already answer at a glance.
 */
export async function GET(request: NextRequest) {
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days") ?? 14), 7), 90);
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - (days - 1));
  rangeStart.setHours(0, 0, 0, 0);

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [plants, scansInRange, maintenanceInRange, roundsLast30, occurrencesOpen, totalEquipment, activeTechnicians, activeVigilantes] =
    await Promise.all([
      prisma.plant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.scan.findMany({
        where: { scannedAt: { gte: rangeStart } },
        select: { scannedAt: true, plantId: true, distanceFlag: true },
      }),
      prisma.maintenanceExecution.findMany({
        where: { completedAt: { gte: rangeStart } },
        select: { completedAt: true, task: { select: { plantId: true } } },
      }),
      prisma.round.findMany({
        where: { status: "COMPLETED", endedAt: { gte: monthAgo } },
        select: { plantId: true, completionPercent: true },
      }),
      prisma.occurrence.findMany({
        where: { status: { notIn: ["RESOLVIDA", "CANCELADA"] } },
        select: { plantId: true, severity: true },
      }),
      prisma.equipment.count(),
      prisma.user.count({ where: { role: "TECNICO_MANUTENCAO", active: true } }),
      prisma.user.count({ where: { role: "VIGILANTE", active: true } }),
    ]);

  const days30Ago = new Date();
  days30Ago.setDate(days30Ago.getDate() - 30);
  const scansLast30 = scansInRange.filter((s) => s.scannedAt >= days30Ago).length;
  const inconsistentLast30 = scansInRange.filter((s) => s.scannedAt >= days30Ago && s.distanceFlag === "inconsistent").length;

  const dayKeys = lastNDays(days);
  const scansByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  for (const s of scansInRange) {
    const k = dateKey(s.scannedAt);
    if (scansByDay.has(k)) scansByDay.set(k, (scansByDay.get(k) ?? 0) + 1);
  }
  const maintenanceByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  for (const m of maintenanceInRange) {
    if (!m.completedAt) continue;
    const k = dateKey(m.completedAt);
    if (maintenanceByDay.has(k)) maintenanceByDay.set(k, (maintenanceByDay.get(k) ?? 0) + 1);
  }

  const severityCount: Record<string, number> = { BAIXA: 0, MEDIA: 0, ALTA: 0, CRITICA: 0 };
  for (const o of occurrencesOpen) severityCount[o.severity] = (severityCount[o.severity] ?? 0) + 1;

  const roundsAvgCompletion =
    roundsLast30.length > 0
      ? Math.round((roundsLast30.reduce((sum, r) => sum + (r.completionPercent ?? 0), 0) / roundsLast30.length) * 10) / 10
      : null;

  const byPlant = plants.map((plant) => {
    const plantScans30 = scansInRange.filter((s) => s.plantId === plant.id && s.scannedAt >= days30Ago).length;
    const plantRounds = roundsLast30.filter((r) => r.plantId === plant.id);
    const plantAvgCompletion =
      plantRounds.length > 0
        ? Math.round((plantRounds.reduce((sum, r) => sum + (r.completionPercent ?? 0), 0) / plantRounds.length) * 10) / 10
        : null;
    const plantOccurrencesOpen = occurrencesOpen.filter((o) => o.plantId === plant.id).length;
    const plantMaintenanceCompleted30 = maintenanceInRange.filter(
      (m) => m.task.plantId === plant.id && m.completedAt && m.completedAt >= days30Ago
    ).length;

    return {
      plantId: plant.id,
      plantName: plant.name,
      scansLast30: plantScans30,
      roundsAvgCompletion: plantAvgCompletion,
      occurrencesOpen: plantOccurrencesOpen,
      maintenanceCompleted30: plantMaintenanceCompleted30,
    };
  });

  return NextResponse.json({
    rangeDays: days,
    overall: {
      totalPlants: plants.length,
      totalEquipment,
      activeTechnicians,
      activeVigilantes,
      scansLast30,
      inconsistentLast30,
      inconsistentRate: scansLast30 > 0 ? Math.round((inconsistentLast30 / scansLast30) * 1000) / 10 : 0,
      roundsAvgCompletion,
      occurrencesOpenTotal: occurrencesOpen.length,
    },
    dailyScans: dayKeys.map((k) => ({ date: k, count: scansByDay.get(k) ?? 0 })),
    dailyMaintenance: dayKeys.map((k) => ({ date: k, count: maintenanceByDay.get(k) ?? 0 })),
    occurrencesBySeverity: severityCount,
    byPlant,
  });
}
