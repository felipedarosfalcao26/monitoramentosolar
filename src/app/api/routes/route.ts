import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const plantId = request.nextUrl.searchParams.get("plantId") ?? undefined;
  const routes = await prisma.inspectionRoute.findMany({
    where: plantId ? { plantId } : undefined,
    orderBy: { name: "asc" },
    include: {
      points: { orderBy: { order: "asc" }, include: { equipment: { select: { id: true, name: true, code: true } } } },
      plant: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ routes });
}

const createRouteSchema = z.object({
  plantId: z.string().min(1),
  name: z.string().min(2),
  shift: z.string().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1),
  toleranceMinutes: z.coerce.number().min(0).default(30),
  points: z
    .array(
      z.object({
        equipmentId: z.string().min(1),
        order: z.number(),
        expectedTimeOfDay: z.string().optional(),
      })
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = createRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { points, daysOfWeek, ...rest } = parsed.data;

  const route = await prisma.inspectionRoute.create({
    data: {
      ...rest,
      daysOfWeek: daysOfWeek.join(","),
      points: { create: points.map((p) => ({ equipmentId: p.equipmentId, order: p.order, expectedTimeOfDay: p.expectedTimeOfDay })) },
    },
    include: { points: true },
  });

  await prisma.auditLog.create({
    data: { userId: session?.sub, action: "CREATE", entity: "InspectionRoute", entityId: route.id },
  });

  return NextResponse.json({ route }, { status: 201 });
}
