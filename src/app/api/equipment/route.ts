import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const plantId = request.nextUrl.searchParams.get("plantId") ?? undefined;
  const equipment = await prisma.equipment.findMany({
    where: plantId ? { plantId } : undefined,
    orderBy: { name: "asc" },
    include: { plant: { select: { id: true, name: true, code: true } }, qrCode: true },
  });
  return NextResponse.json({ equipment });
}

const createEquipmentSchema = z.object({
  plantId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(2),
  type: z.string().min(2),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = createEquipmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const plant = await prisma.plant.findUnique({ where: { id: parsed.data.plantId } });
  if (!plant) {
    return NextResponse.json({ error: "Usina não encontrada" }, { status: 404 });
  }

  const duplicate = await prisma.equipment.findUnique({
    where: { plantId_code: { plantId: parsed.data.plantId, code: parsed.data.code } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Já existe um equipamento com este código nesta usina" }, { status: 409 });
  }

  const equipment = await prisma.equipment.create({ data: parsed.data });

  // Every equipment gets its unique QR token generated immediately —
  // it is the whole reason inspections can be captured (rule 1: no duplicate tokens).
  const qrCode = await prisma.qrCode.create({
    data: { equipmentId: equipment.id, token: randomUUID() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session?.sub,
      action: "CREATE",
      entity: "Equipment",
      entityId: equipment.id,
      after: JSON.stringify(equipment),
    },
  });

  return NextResponse.json({ equipment: { ...equipment, qrCode } }, { status: 201 });
}
