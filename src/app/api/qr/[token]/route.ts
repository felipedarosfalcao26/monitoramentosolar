import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const qrCode = await prisma.qrCode.findUnique({
    where: { token },
    include: { equipment: { include: { plant: true } } },
  });

  if (!qrCode) {
    return NextResponse.json({ error: "QR Code inválido ou não encontrado" }, { status: 404 });
  }

  if (qrCode.status !== "ACTIVE") {
    return NextResponse.json({ error: "Este QR Code foi invalidado", invalid: true }, { status: 410 });
  }

  return NextResponse.json({
    equipment: {
      id: qrCode.equipment.id,
      code: qrCode.equipment.code,
      name: qrCode.equipment.name,
      type: qrCode.equipment.type,
      latitude: qrCode.equipment.latitude,
      longitude: qrCode.equipment.longitude,
      plant: { id: qrCode.equipment.plant.id, name: qrCode.equipment.plant.name },
    },
  });
}
