import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = await prisma.inspectionRoute.findUnique({
    where: { id },
    include: {
      points: { orderBy: { order: "asc" }, include: { equipment: true } },
      plant: { select: { id: true, name: true } },
    },
  });
  if (!route) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });
  return NextResponse.json({ route });
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  shift: z.string().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  toleranceMinutes: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
  points: z
    .array(
      z.object({
        equipmentId: z.string().min(1),
        order: z.number(),
        expectedTimeOfDay: z.string().optional(),
      })
    )
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.inspectionRoute.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Rota não encontrada" }, { status: 404 });

  const { points, daysOfWeek, ...rest } = parsed.data;

  const route = await prisma.$transaction(async (tx) => {
    if (points) {
      await tx.routePoint.deleteMany({ where: { routeId: id } });
      await tx.routePoint.createMany({
        data: points.map((p) => ({ routeId: id, equipmentId: p.equipmentId, order: p.order, expectedTimeOfDay: p.expectedTimeOfDay })),
      });
    }
    return tx.inspectionRoute.update({
      where: { id },
      data: { ...rest, daysOfWeek: daysOfWeek ? daysOfWeek.join(",") : undefined },
      include: { points: { orderBy: { order: "asc" } } },
    });
  });

  await prisma.auditLog.create({
    data: { userId: session?.sub, action: "UPDATE", entity: "InspectionRoute", entityId: id },
  });

  return NextResponse.json({ route });
}
