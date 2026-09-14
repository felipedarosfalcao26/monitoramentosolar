import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCurrentExecutions } from "@/lib/maintenanceEngine";
import type { Prisma } from "@prisma/client";

/**
 * Returns today's due maintenance activities, materializing a PENDENTE
 * MaintenanceExecution row for any active task whose current period doesn't
 * have one yet, and flipping unfinished-but-overdue rows to ATRASADA.
 * A technician only ever sees tasks assigned to them or left unassigned
 * (first-come); back-office roles may filter by plantId/userId to inspect
 * anyone's day.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const requestedUserId = searchParams.get("userId") ?? undefined;

  const where: Prisma.MaintenanceTaskWhereInput = {
    plantId,
    ...(session.role === "TECNICO_MANUTENCAO"
      ? { OR: [{ assignedUserId: null }, { assignedUserId: requestedUserId ?? session.sub }] }
      : { assignedUserId: requestedUserId }),
  };

  const executions = await getCurrentExecutions(where);
  return NextResponse.json({ executions });
}
