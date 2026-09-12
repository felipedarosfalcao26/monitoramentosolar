import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const original = await prisma.inspectionRoute.findUnique({ where: { id }, include: { points: true } });
  if (!original) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });

  const copy = await prisma.inspectionRoute.create({
    data: {
      plantId: original.plantId,
      name: `${original.name} (cópia)`,
      shift: original.shift,
      daysOfWeek: original.daysOfWeek,
      toleranceMinutes: original.toleranceMinutes,
      points: {
        create: original.points.map((p) => ({
          equipmentId: p.equipmentId,
          order: p.order,
          expectedTimeOfDay: p.expectedTimeOfDay,
        })),
      },
    },
    include: { points: true },
  });

  await prisma.auditLog.create({
    data: { userId: session?.sub, action: "DUPLICATE", entity: "InspectionRoute", entityId: copy.id },
  });

  return NextResponse.json({ route: copy }, { status: 201 });
}
