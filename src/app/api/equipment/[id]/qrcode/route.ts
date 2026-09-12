import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** Regenerate: invalidate the current token and issue a brand new one. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const equipment = await prisma.equipment.findUnique({ where: { id }, include: { qrCode: true } });
  if (!equipment) {
    return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 });
  }

  const qrCode = await prisma.$transaction(async (tx) => {
    if (equipment.qrCode) {
      await tx.qrCode.update({
        where: { id: equipment.qrCode.id },
        data: { status: "INVALIDATED", invalidatedAt: new Date() },
      });
    }
    return tx.qrCode.create({ data: { equipmentId: id, token: randomUUID() } });
  });

  await prisma.auditLog.create({
    data: { userId: session?.sub, action: "REGENERATE_QRCODE", entity: "Equipment", entityId: id },
  });

  return NextResponse.json({ qrCode });
}
