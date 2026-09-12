import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (session) {
    await prisma.auditLog.create({
      data: { userId: session.sub, action: "LOGOUT", entity: "User", entityId: session.sub },
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
