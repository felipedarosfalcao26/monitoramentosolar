import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const plants = await prisma.plant.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { equipment: true } } },
  });
  return NextResponse.json({ plants });
}

const createPlantSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  ownerCompany: z.string().min(2),
  cnpj: z.string().optional(),
  state: z.string().min(2),
  city: z.string().min(2),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  areaHectares: z.coerce.number().optional(),
  status: z.string().optional(),
  operationDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = createPlantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.plant.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma usina com este código" }, { status: 409 });
  }

  const plant = await prisma.plant.create({
    data: {
      ...parsed.data,
      operationDate: parsed.data.operationDate ? new Date(parsed.data.operationDate) : undefined,
      status: parsed.data.status ?? "ATIVA",
    },
  });

  await prisma.auditLog.create({
    data: { userId: session?.sub, action: "CREATE", entity: "Plant", entityId: plant.id, after: JSON.stringify(plant) },
  });

  return NextResponse.json({ plant }, { status: 201 });
}
