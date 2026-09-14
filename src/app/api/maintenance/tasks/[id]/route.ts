import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { MAINTENANCE_FREQUENCIES } from "@/lib/maintenanceSchedule";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.maintenanceTask.findUnique({
    where: { id },
    include: {
      plant: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true } },
      assignedUser: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Atividade não encontrada" }, { status: 404 });
  return NextResponse.json({ task });
}

const patchSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  frequency: z.enum(MAINTENANCE_FREQUENCIES).optional(),
  scheduledMonths: z.array(z.number().int().min(1).max(12)).optional(),
  requiredTechnicians: z.coerce.number().int().min(1).optional(),
  assignedRole: z.string().nullable().optional(),
  assignedUserId: z.string().nullable().optional(),
  equipmentId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "VIGILANTE" || session.role === "TECNICO_MANUTENCAO") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Atividade não encontrada" }, { status: 404 });

  const task = await prisma.maintenanceTask.update({
    where: { id },
    data: parsed.data,
    include: {
      plant: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true } },
      assignedUser: { select: { id: true, name: true, phone: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.sub,
      action: "UPDATE",
      entity: "MaintenanceTask",
      entityId: id,
      before: JSON.stringify(existing),
      after: JSON.stringify(task),
    },
  });

  return NextResponse.json({ task });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.maintenanceTask.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Atividade não encontrada" }, { status: 404 });

  await prisma.$transaction([
    prisma.maintenanceExecution.deleteMany({ where: { taskId: id } }),
    prisma.maintenanceTask.delete({ where: { id } }),
  ]);

  await prisma.auditLog.create({
    data: { userId: session.sub, action: "DELETE", entity: "MaintenanceTask", entityId: id, before: JSON.stringify(existing) },
  });

  return NextResponse.json({ ok: true });
}
