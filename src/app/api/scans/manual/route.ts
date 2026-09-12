import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { classifyDistance, haversineDistanceMeters } from "@/lib/geo";

const createManualSchema = z.object({
  equipmentId: z.string().min(1),
  userId: z.string().min(1),
  scannedAt: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
});

/** Admin/Gestor back-office entry — for corrections or records captured outside the mobile flow. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "VIGILANTE") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createManualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const equipment = await prisma.equipment.findUnique({ where: { id: parsed.data.equipmentId }, include: { qrCode: true } });
  if (!equipment) return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const latitude = parsed.data.latitude ?? equipment.latitude;
  const longitude = parsed.data.longitude ?? equipment.longitude;
  const distanceFromEquipmentM = haversineDistanceMeters(latitude, longitude, equipment.latitude, equipment.longitude);
  const distanceFlag = classifyDistance(distanceFromEquipmentM);
  const photoUrls = parsed.data.photoUrls ?? [];

  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      plantId: equipment.plantId,
      equipmentId: equipment.id,
      qrToken: equipment.qrCode?.token ?? "manual",
      scannedAt: parsed.data.scannedAt ? new Date(parsed.data.scannedAt) : undefined,
      latitude,
      longitude,
      distanceFromEquipmentM,
      distanceFlag,
      notes: parsed.data.notes,
      photoUrls,
      photoUrl: photoUrls[0] ?? null,
      deviceInfo: `Registro manual por ${session.name}`,
    },
    include: {
      user: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
      plant: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.sub, action: "CREATE_MANUAL", entity: "Scan", entityId: scan.id, after: JSON.stringify(scan) },
  });

  return NextResponse.json({ scan }, { status: 201 });
}
