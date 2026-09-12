import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const alerts = await prisma.alert.findMany({
    where: { plantId, status },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { plant: { select: { name: true } }, round: { select: { id: true, userId: true } } },
  });

  return NextResponse.json({ alerts });
}
