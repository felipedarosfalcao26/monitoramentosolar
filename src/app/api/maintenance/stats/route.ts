import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCurrentExecutions } from "@/lib/maintenanceEngine";

type Counts = { PENDENTE: number; EM_ANDAMENTO: number; CONCLUIDA: number; ATRASADA: number; CANCELADA: number };
function emptyCounts(): Counts {
  return { PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDA: 0, ATRASADA: 0, CANCELADA: 0 };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const plantId = request.nextUrl.searchParams.get("plantId") ?? undefined;
  const executions = await getCurrentExecutions({ plantId });

  const overall = emptyCounts();
  const byPlant = new Map<string, { plantId: string; plantName: string } & Counts>();
  const byTechnician = new Map<string, { userId: string; userName: string } & Counts>();
  let unassigned = 0;

  for (const ex of executions) {
    const status = ex.status as keyof Counts;
    overall[status]++;

    const plantEntry = byPlant.get(ex.task.plantId) ?? {
      plantId: ex.task.plantId,
      plantName: ex.task.plant.name,
      ...emptyCounts(),
    };
    plantEntry[status]++;
    byPlant.set(ex.task.plantId, plantEntry);

    const tech = ex.task.assignedUser;
    if (tech) {
      const techEntry = byTechnician.get(tech.id) ?? { userId: tech.id, userName: tech.name, ...emptyCounts() };
      techEntry[status]++;
      byTechnician.set(tech.id, techEntry);
    } else {
      unassigned++;
    }
  }

  return NextResponse.json({
    total: executions.length,
    overall,
    unassigned,
    byPlant: [...byPlant.values()],
    byTechnician: [...byTechnician.values()],
  });
}
