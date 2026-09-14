import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plant = await prisma.plant.findUnique({
    where: { id },
    include: { equipment: { orderBy: { name: "asc" } } },
  });
  if (!plant) {
    return NextResponse.json({ error: "Usina não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ plant });
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).optional(),
  ownerCompany: z.string().min(2).optional(),
  cnpj: z.string().optional(),
  state: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  areaHectares: z.coerce.number().optional(),
  status: z.string().optional(),
  operationDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role === "VIGILANTE") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.plant.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Usina não encontrada" }, { status: 404 });
  }

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const codeTaken = await prisma.plant.findUnique({ where: { code: parsed.data.code } });
    if (codeTaken) {
      return NextResponse.json({ error: "Já existe uma usina com este código" }, { status: 409 });
    }
  }

  const plant = await prisma.plant.update({
    where: { id },
    data: {
      ...parsed.data,
      operationDate: parsed.data.operationDate ? new Date(parsed.data.operationDate) : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.sub,
      action: "UPDATE",
      entity: "Plant",
      entityId: id,
      before: JSON.stringify(existing),
      after: JSON.stringify(plant),
    },
  });

  return NextResponse.json({ plant });
}

/** Deletes a plant and everything scoped to it (equipment, QR codes, routes, rounds, scans, occurrences, alerts). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const existing = await prisma.plant.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Usina não encontrada" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.occurrence.deleteMany({ where: { plantId: id } }),
    prisma.alert.deleteMany({ where: { plantId: id } }),
    prisma.scan.deleteMany({ where: { plantId: id } }),
    prisma.round.deleteMany({ where: { plantId: id } }),
    prisma.routePoint.deleteMany({ where: { route: { plantId: id } } }),
    prisma.inspectionRoute.deleteMany({ where: { plantId: id } }),
    prisma.qrCode.deleteMany({ where: { equipment: { plantId: id } } }),
    prisma.equipment.deleteMany({ where: { plantId: id } }),
    prisma.plant.delete({ where: { id } }),
  ]);

  await prisma.auditLog.create({
    data: { userId: session.sub, action: "DELETE", entity: "Plant", entityId: id, before: JSON.stringify(existing) },
  });

  return NextResponse.json({ ok: true });
}
