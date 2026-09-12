import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "resolve") {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const alert = await prisma.alert.update({
    where: { id },
    data: { status: "RESOLVIDO", resolvedAt: new Date() },
  });

  return NextResponse.json({ alert });
}
