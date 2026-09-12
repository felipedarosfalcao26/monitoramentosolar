import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ROLES } from "@/lib/roles";

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(ROLES).optional(),
  newPassword: z.string().min(6).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const data: { active?: boolean; role?: string; passwordHash?: string } = {};
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.newPassword) data.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  const updated = await prisma.user.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: session?.sub,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      before: JSON.stringify({ active: existing.active, role: existing.role }),
      after: JSON.stringify({ active: updated.active, role: updated.role, passwordReset: !!parsed.data.newPassword }),
    },
  });

  return NextResponse.json({
    user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active },
  });
}
