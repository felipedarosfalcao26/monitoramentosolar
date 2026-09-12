import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createAlert } from "@/lib/alerts";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const plantId = searchParams.get("plantId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const equipmentId = searchParams.get("equipmentId") ?? undefined;
  const userIdParam = searchParams.get("userId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const occurrences = await prisma.occurrence.findMany({
    where: {
      plantId,
      status,
      equipmentId,
      userId: session.role === "VIGILANTE" ? session.sub : userIdParam,
      createdAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      user: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ occurrences });
}

const CATEGORIES = [
  "PORTAO_ABERTO",
  "CERCA_DANIFICADA",
  "ILUMINACAO_APAGADA",
  "EQUIPAMENTO_DANIFICADO",
  "PRESENCA_TERCEIROS",
  "VEGETACAO",
  "ALAGAMENTO",
  "FURTO_TENTATIVA",
  "ANOMALIA_OPERACIONAL",
  "OUTRO",
] as const;

const createOccurrenceSchema = z.object({
  scanId: z.string().optional(),
  equipmentId: z.string().optional(),
  plantId: z.string().min(1),
  category: z.enum(CATEGORIES),
  severity: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createOccurrenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { photoUrl: _legacyPhotoUrl, photoUrls: rawPhotoUrls, ...rest } = parsed.data;
  const photoUrls = rawPhotoUrls ?? (_legacyPhotoUrl ? [_legacyPhotoUrl] : []);

  const occurrence = await prisma.occurrence.create({
    data: { ...rest, photoUrls, photoUrl: photoUrls[0] ?? null, userId: session.sub },
    include: { equipment: { select: { name: true } } },
  });

  if (occurrence.severity === "CRITICA") {
    await createAlert({
      plantId: occurrence.plantId,
      type: "OCORRENCIA_CRITICA",
      severity: "CRITICA",
      message: `Ocorrência crítica registrada${occurrence.equipment ? ` em ${occurrence.equipment.name}` : ""}: ${occurrence.category}.`,
    });
  }

  return NextResponse.json({ occurrence }, { status: 201 });
}
