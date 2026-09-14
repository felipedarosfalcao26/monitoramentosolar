import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { MAINTENANCE_FREQUENCIES } from "@/lib/maintenanceSchedule";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const frequency = searchParams.get("frequency") ?? undefined;
  const activeParam = searchParams.get("active");
  const assignedUserId = searchParams.get("assignedUserId") ?? undefined;

  const tasks = await prisma.maintenanceTask.findMany({
    where: {
      plantId,
      frequency,
      active: activeParam === null ? undefined : activeParam === "true",
      assignedUserId,
    },
    orderBy: [{ plantId: "asc" }, { frequency: "asc" }, { title: "asc" }],
    include: {
      plant: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true } },
      assignedUser: { select: { id: true, name: true, phone: true } },
    },
  });

  return NextResponse.json({ tasks });
}

const createTaskSchema = z.object({
  plantId: z.string().min(1),
  equipmentId: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.string().optional(),
  frequency: z.enum(MAINTENANCE_FREQUENCIES),
  scheduledMonths: z.array(z.number().int().min(1).max(12)).optional(),
  requiredTechnicians: z.coerce.number().int().min(1).default(1),
  assignedRole: z.string().optional(),
  assignedUserId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "VIGILANTE" || session.role === "TECNICO_MANUTENCAO") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const plant = await prisma.plant.findUnique({ where: { id: parsed.data.plantId } });
  if (!plant) return NextResponse.json({ error: "Usina não encontrada" }, { status: 404 });

  const task = await prisma.maintenanceTask.create({
    data: { ...parsed.data, scheduledMonths: parsed.data.scheduledMonths ?? [] },
    include: {
      plant: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true } },
      assignedUser: { select: { id: true, name: true, phone: true } },
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.sub, action: "CREATE", entity: "MaintenanceTask", entityId: task.id, after: JSON.stringify(task) },
  });

  return NextResponse.json({ task }, { status: 201 });
}
