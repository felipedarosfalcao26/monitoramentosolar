import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ROLES } from "@/lib/roles";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES),
  phone: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { name, email, password, role, phone } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Já existe um usuário com este e-mail" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash, role, phone },
  });

  await prisma.auditLog.create({
    data: { userId: session?.sub, action: "CREATE", entity: "User", entityId: user.id, after: JSON.stringify({ name, email, role }) },
  });

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, active: user.active } },
    { status: 201 }
  );
}
