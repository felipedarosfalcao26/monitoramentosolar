import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { classifyDistance, haversineDistanceMeters } from "@/lib/geo";
import { MAINTENANCE_STATUSES, REVIEW_STATUSES } from "@/lib/maintenanceSchedule";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const execution = await prisma.maintenanceExecution.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      task: {
        include: {
          plant: { select: { id: true, name: true } },
          equipment: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
        },
      },
    },
  });
  if (!execution) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  return NextResponse.json({ execution });
}

const patchSchema = z.object({
  action: z.enum(["start", "complete", "review"]).optional(),
  qrToken: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().nullable().optional(),
  photoUrls: z.array(z.string()).optional(),
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  userId: z.string().nullable().optional(),
  reviewStatus: z.enum(REVIEW_STATUSES).optional(),
  reviewNotes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.maintenanceExecution.findUnique({ where: { id }, include: { task: true } });
  if (!existing) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  const isFieldRole = session.role === "TECNICO_MANUTENCAO";
  if (isFieldRole && existing.userId && existing.userId !== session.sub) {
    return NextResponse.json({ error: "Esta atividade já está sendo executada por outro técnico" }, { status: 403 });
  }

  const { action, qrToken, latitude, longitude, notes, photoUrls } = parsed.data;

  if (action === "start") {
    const execution = await prisma.maintenanceExecution.update({
      where: { id },
      data: { status: "EM_ANDAMENTO", userId: existing.userId ?? session.sub, startedAt: existing.startedAt ?? new Date() },
    });
    return NextResponse.json({ execution });
  }

  if (action === "complete") {
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "É necessário compartilhar sua localização para concluir esta atividade" },
        { status: 400 }
      );
    }
    if (existing.task.equipmentId) {
      if (!qrToken) {
        return NextResponse.json({ error: "É necessário ler o QR Code do equipamento para concluir esta atividade" }, { status: 400 });
      }
      const qrCode = await prisma.qrCode.findUnique({ where: { token: qrToken } });
      if (!qrCode || qrCode.equipmentId !== existing.task.equipmentId) {
        return NextResponse.json({ error: "QR Code não corresponde ao equipamento desta atividade" }, { status: 400 });
      }
    }

    let distanceFromEquipmentM: number | undefined;
    let distanceFlag: string | undefined;
    if (latitude !== undefined && longitude !== undefined && existing.task.equipmentId) {
      const equipment = await prisma.equipment.findUnique({ where: { id: existing.task.equipmentId } });
      if (equipment) {
        distanceFromEquipmentM = haversineDistanceMeters(latitude, longitude, equipment.latitude, equipment.longitude);
        distanceFlag = classifyDistance(distanceFromEquipmentM);
      }
    }

    const execution = await prisma.maintenanceExecution.update({
      where: { id },
      data: {
        status: "CONCLUIDA",
        userId: existing.userId ?? session.sub,
        startedAt: existing.startedAt ?? new Date(),
        completedAt: new Date(),
        latitude,
        longitude,
        distanceFromEquipmentM,
        distanceFlag,
        notes: notes ?? existing.notes,
        photoUrls: photoUrls ?? existing.photoUrls,
      },
    });
    return NextResponse.json({ execution });
  }

  if (action === "review") {
    if (isFieldRole) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    if (existing.status !== "CONCLUIDA") {
      return NextResponse.json({ error: "Só é possível avaliar atividades concluídas" }, { status: 400 });
    }
    if (!parsed.data.reviewStatus) {
      return NextResponse.json({ error: "Informe o resultado da avaliação" }, { status: 400 });
    }
    const execution = await prisma.maintenanceExecution.update({
      where: { id },
      data: {
        reviewStatus: parsed.data.reviewStatus,
        reviewNotes: parsed.data.reviewNotes ?? null,
        reviewedBy: session.sub,
        reviewedAt: new Date(),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: session.sub,
        action: "REVIEW",
        entity: "MaintenanceExecution",
        entityId: id,
        before: existing.reviewStatus,
        after: parsed.data.reviewStatus,
      },
    });
    return NextResponse.json({ execution });
  }

  // Generic back-office edit (status override, reassignment, correcting notes/photos).
  if (isFieldRole) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.userId !== undefined) data.userId = parsed.data.userId;
  if (notes !== undefined) data.notes = notes;
  if (photoUrls !== undefined) data.photoUrls = photoUrls;
  if (latitude !== undefined) data.latitude = latitude;
  if (longitude !== undefined) data.longitude = longitude;

  const execution = await prisma.maintenanceExecution.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: session.sub,
      action: "UPDATE",
      entity: "MaintenanceExecution",
      entityId: id,
      before: JSON.stringify(existing),
      after: JSON.stringify(execution),
    },
  });

  return NextResponse.json({ execution });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "VIGILANTE" || session.role === "TECNICO_MANUTENCAO") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.maintenanceExecution.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  await prisma.maintenanceExecution.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { userId: session.sub, action: "DELETE", entity: "MaintenanceExecution", entityId: id, before: JSON.stringify(existing) },
  });

  return NextResponse.json({ ok: true });
}
