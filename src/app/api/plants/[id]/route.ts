import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plant = await prisma.plant.findUnique({
    where: { id },
    include: { equipment: { orderBy: { name: "asc" } } },
  });
  if (!plant) {
    return NextResponse.json({ error: "Usina não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ plant });
}
