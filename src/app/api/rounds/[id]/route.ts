import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { pathDistanceMeters } from "@/lib/geo";
import { createAlert } from "@/lib/alerts";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true } },
      route: { include: { points: { orderBy: { order: "asc" }, include: { equipment: true } } } },
      scans: { orderBy: { scannedAt: "asc" }, include: { equipment: { select: { id: true, name: true, code: true } } } },
    },
  });
  if (!round) return NextResponse.json({ error: "Ronda não encontrada" }, { status: 404 });
  return NextResponse.json({ round });
}

/** Ends a round: computes visited/planned points, completion %, distance, and raises alerts. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.action !== "end") {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const round = await prisma.round.findUnique({
    where: { id },
    include: { scans: true, route: { include: { points: true } } },
  });
  if (!round) return NextResponse.json({ error: "Ronda não encontrada" }, { status: 404 });
  if (round.userId !== session.sub && session.role === "VIGILANTE") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  if (round.status === "COMPLETED") {
    return NextResponse.json({ round });
  }

  const visitedEquipmentIds = new Set(round.scans.map((s) => s.equipmentId));
  const plannedPoints = round.route ? round.route.points.length : round.plannedPoints || visitedEquipmentIds.size;
  const visitedPoints = visitedEquipmentIds.size;
  const completionPercent = plannedPoints > 0 ? Math.round((visitedPoints / plannedPoints) * 1000) / 10 : null;
  const orderedScans = [...round.scans].sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime());
  const distanceMeters = Math.round(pathDistanceMeters(orderedScans));

  const updated = await prisma.round.update({
    where: { id },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      plannedPoints,
      visitedPoints,
      completionPercent,
      distanceMeters,
    },
  });

  if (round.route && completionPercent !== null && completionPercent < 100) {
    const missing = round.route.points.filter((p) => !visitedEquipmentIds.has(p.equipmentId)).length;
    await createAlert({
      plantId: round.plantId,
      roundId: round.id,
      type: "RONDA_INCOMPLETA",
      severity: completionPercent < 70 ? "ALTA" : "MEDIA",
      message: `Ronda concluída com ${completionPercent}% dos pontos visitados (${missing} ponto(s) não visitado(s)).`,
    });
  }

  return NextResponse.json({ round: updated });
}
