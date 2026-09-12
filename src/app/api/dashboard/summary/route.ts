import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalScans, scansToday, totalPlants, totalEquipment, totalUsers, scansByFlag, recentScans, equipmentVisitedTodayIds] =
    await Promise.all([
      prisma.scan.count(),
      prisma.scan.count({ where: { scannedAt: { gte: startOfDay } } }),
      prisma.plant.count(),
      prisma.equipment.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.scan.groupBy({ by: ["distanceFlag"], _count: true, where: { scannedAt: { gte: startOfDay } } }),
      prisma.scan.findMany({
        take: 10,
        orderBy: { scannedAt: "desc" },
        include: {
          user: { select: { name: true } },
          equipment: { select: { name: true, code: true } },
          plant: { select: { name: true } },
        },
      }),
      prisma.scan.findMany({
        where: { scannedAt: { gte: startOfDay } },
        select: { equipmentId: true },
        distinct: ["equipmentId"],
      }),
    ]);

  const equipmentNotVisitedToday = totalEquipment - equipmentVisitedTodayIds.length;

  return NextResponse.json({
    totalScans,
    scansToday,
    totalPlants,
    totalEquipment,
    totalUsers,
    equipmentVisitedToday: equipmentVisitedTodayIds.length,
    equipmentNotVisitedToday: Math.max(equipmentNotVisitedToday, 0),
    scansByFlagToday: scansByFlag.map((row) => ({ flag: row.distanceFlag ?? "ok", count: row._count })),
    recentScans,
  });
}
