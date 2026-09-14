import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const executions = await prisma.maintenanceExecution.findMany({
    where: {
      status,
      userId: session.role === "TECNICO_MANUTENCAO" ? session.sub : userId,
      task: plantId ? { plantId } : undefined,
      dueDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
    },
    orderBy: { dueDate: "desc" },
    take: 500,
    include: {
      user: { select: { id: true, name: true } },
      task: {
        select: {
          id: true,
          title: true,
          category: true,
          frequency: true,
          plant: { select: { id: true, name: true } },
          equipment: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  return NextResponse.json({ executions });
}
