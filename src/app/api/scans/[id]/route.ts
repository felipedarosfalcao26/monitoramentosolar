import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { classifyDistance, haversineDistanceMeters } from "@/lib/geo";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
      plant: { select: { id: true, name: true } },
    },
  });
  if (!scan) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  return NextResponse.json({ scan });
}

const patchSchema = z.object({
  scannedAt: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
  equipmentId: z.string().optional(),
});

/** Back-office correction of a field-captured record. Every change is written to AuditLog. */
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

  const existing = await prisma.scan.findUnique({ where: { id }, include: { equipment: true } });
  if (!existing) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  const equipment = parsed.data.equipmentId
    ? await prisma.equipment.findUnique({ where: { id: parsed.data.equipmentId } })
    : existing.equipment;
  if (!equipment) return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 });

  const latitude = parsed.data.latitude ?? existing.latitude;
  const longitude = parsed.data.longitude ?? existing.longitude;
  const distanceFromEquipmentM = haversineDistanceMeters(latitude, longitude, equipment.latitude, equipment.longitude);
  const distanceFlag = classifyDistance(distanceFromEquipmentM);

  const data: Record<string, unknown> = {
    latitude,
    longitude,
    distanceFromEquipmentM,
    distanceFlag,
  };
  if (parsed.data.scannedAt) data.scannedAt = new Date(parsed.data.scannedAt);
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.photoUrls !== undefined) {
    data.photoUrls = parsed.data.photoUrls;
    data.photoUrl = parsed.data.photoUrls[0] ?? null;
  }
  if (parsed.data.equipmentId) {
    data.equipmentId = parsed.data.equipmentId;
    data.plantId = equipment.plantId;
  }

  const updated = await prisma.scan.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
      plant: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.sub,
      action: "UPDATE",
      entity: "Scan",
      entityId: id,
      before: JSON.stringify(existing),
      after: JSON.stringify(updated),
    },
  });

  return NextResponse.json({ scan: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role === "VIGILANTE") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const existing = await prisma.scan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  await prisma.auditLog.create({
    data: {
      userId: session.sub,
      action: "DELETE",
      entity: "Scan",
      entityId: id,
      before: JSON.stringify(existing),
    },
  });
  await prisma.occurrence.updateMany({ where: { scanId: id }, data: { scanId: null } });
  await prisma.scan.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
