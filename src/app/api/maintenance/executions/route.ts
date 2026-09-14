import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const userId = session.role === "TECNICO_MANUTENCAO" ? session.sub : searchParams.get("userId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const frequency = searchParams.get("frequency") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const and: Prisma.MaintenanceExecutionWhereInput[] = [{ task: { plantId, frequency } }];

  // A técnico "owns" an execution either by having actually done it (userId)
  // or by having the underlying task assigned to them even if not started yet.
  if (userId) {
    and.push({ OR: [{ userId }, { task: { assignedUserId: userId } }] });
  }

  // "NAO_CONCLUIDA" is a meta-status covering everything still open (pending/in
  // progress/late) — a real column value would need a notIn instead of ==.
  if (status === "NAO_CONCLUIDA") {
    and.push({ status: { notIn: ["CONCLUIDA", "CANCELADA"] } });
  } else if (status) {
    and.push({ status });
  }

  // A day may hold an execution whose deadline (dueDate) falls in it, or one
  // actually completed in it even though its deadline is elsewhere (e.g. a
  // monthly task due on the 30th but done on the 5th) — match either.
  if (from || to) {
    const range = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
    and.push({ OR: [{ dueDate: range }, { completedAt: range }] });
  }

  const executions = await prisma.maintenanceExecution.findMany({
    where: { AND: and },
    orderBy: { dueDate: "desc" },
    take: 500,
    include: {
      user: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          frequency: true,
          assignedUserId: true,
          plant: { select: { id: true, name: true } },
          equipment: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  return NextResponse.json({ executions });
}
