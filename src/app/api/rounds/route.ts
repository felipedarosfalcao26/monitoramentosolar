import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const rounds = await prisma.round.findMany({
    where: {
      plantId,
      userId: session.role === "VIGILANTE" ? session.sub : userId,
      startedAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { startedAt: "desc" },
    take: 500,
    include: {
      user: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true } },
      route: { select: { id: true, name: true } },
      _count: { select: { scans: true } },
    },
  });

  return NextResponse.json({ rounds });
}

const createRoundSchema = z.object({
  plantId: z.string().min(1),
  routeId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const openRound = await prisma.round.findFirst({
    where: { userId: session.sub, status: "IN_PROGRESS" },
  });
  if (openRound) {
    return NextResponse.json({ error: "Você já tem uma ronda em andamento", round: openRound }, { status: 409 });
  }

  let plannedPoints = 0;
  if (parsed.data.routeId) {
    plannedPoints = await prisma.routePoint.count({ where: { routeId: parsed.data.routeId } });
  }

  const round = await prisma.round.create({
    data: {
      userId: session.sub,
      plantId: parsed.data.plantId,
      routeId: parsed.data.routeId,
      plannedPoints,
    },
    include: { route: { include: { points: { include: { equipment: true }, orderBy: { order: "asc" } } } } },
  });

  return NextResponse.json({ round }, { status: 201 });
}
