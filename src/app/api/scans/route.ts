import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { classifyDistance, haversineDistanceMeters } from "@/lib/geo";
import { createAlert } from "@/lib/alerts";

const createScanSchema = z.object({
  qrToken: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().optional(),
  deviceInfo: z.string().optional(),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
  roundId: z.string().optional(),
  offlineCreatedAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const qrCode = await prisma.qrCode.findUnique({
    where: { token: parsed.data.qrToken },
    include: { equipment: true },
  });

  if (!qrCode) {
    return NextResponse.json({ error: "QR Code não encontrado" }, { status: 404 });
  }
  if (qrCode.status !== "ACTIVE") {
    return NextResponse.json({ error: "Este QR Code foi invalidado" }, { status: 410 });
  }

  const { latitude, longitude, accuracyMeters, deviceInfo, notes, photoUrl, roundId, offlineCreatedAt } = parsed.data;

  let validatedRoundId: string | undefined;
  if (roundId) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (round && round.userId === session.sub && round.status === "IN_PROGRESS") {
      validatedRoundId = round.id;
    }
  }

  const distanceFromEquipmentM = haversineDistanceMeters(
    latitude,
    longitude,
    qrCode.equipment.latitude,
    qrCode.equipment.longitude
  );
  const distanceFlag = classifyDistance(distanceFromEquipmentM);

  // Reading is never blocked by distance or duplication — it is always recorded,
  // only classified, so the event stream stays a complete, honest audit trail.
  const scan = await prisma.scan.create({
    data: {
      userId: session.sub,
      plantId: qrCode.equipment.plantId,
      equipmentId: qrCode.equipmentId,
      roundId: validatedRoundId,
      qrToken: qrCode.token,
      latitude,
      longitude,
      accuracyMeters,
      deviceInfo,
      notes,
      photoUrl,
      distanceFromEquipmentM,
      distanceFlag,
      offlineCreatedAt: offlineCreatedAt ? new Date(offlineCreatedAt) : undefined,
      syncedAt: offlineCreatedAt ? new Date() : undefined,
    },
    include: { equipment: true, plant: true },
  });

  if (distanceFlag === "inconsistent") {
    await createAlert({
      plantId: scan.plantId,
      roundId: validatedRoundId,
      type: "LEITURA_INCONSISTENTE",
      severity: "ALTA",
      message: `Leitura de "${qrCode.equipment.name}" registrada a ${Math.round(distanceFromEquipmentM)}m do ponto cadastrado.`,
    });
  }

  return NextResponse.json({ scan }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const equipmentId = searchParams.get("equipmentId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const scans = await prisma.scan.findMany({
    where: {
      plantId,
      equipmentId,
      // Vigilantes only ever see their own scans; back-office roles see everyone's.
      userId: session.role === "VIGILANTE" ? session.sub : userId,
      scannedAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { scannedAt: "desc" },
    take: 1000,
    include: {
      user: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
      plant: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ scans });
}
