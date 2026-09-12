import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: { plant: true, qrCode: true },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ equipment });
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.string().min(2).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 });
  }

  const equipment = await prisma.equipment.update({ where: { id }, data: parsed.data });

  await prisma.auditLog.create({
    data: {
      userId: session?.sub,
      action: "UPDATE",
      entity: "Equipment",
      entityId: id,
      before: JSON.stringify(existing),
      after: JSON.stringify(equipment),
    },
  });

  return NextResponse.json({ equipment });
}
