import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const patchSchema = z.object({
  status: z.enum(["ABERTA", "EM_ANALISE", "EM_ANDAMENTO", "RESOLVIDA", "CANCELADA"]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const existing = await prisma.occurrence.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });

  const occurrence = await prisma.occurrence.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "RESOLVIDA" ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session?.sub,
      action: "UPDATE_STATUS",
      entity: "Occurrence",
      entityId: id,
      before: existing.status,
      after: occurrence.status,
    },
  });

  return NextResponse.json({ occurrence });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role === "VIGILANTE") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const existing = await prisma.occurrence.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Ocorrência não encontrada" }, { status: 404 });

  await prisma.occurrence.delete({ where: { id } });

  await prisma.auditLog.create({
    data: { userId: session.sub, action: "DELETE", entity: "Occurrence", entityId: id, before: JSON.stringify(existing) },
  });

  return NextResponse.json({ ok: true });
}
