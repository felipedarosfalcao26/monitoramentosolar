import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "png";

  const qrCode = await prisma.qrCode.findUnique({ where: { token } });
  if (!qrCode) {
    return NextResponse.json({ error: "QR Code não encontrado" }, { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const scanUrl = `${origin}/scan?token=${token}`;

  if (format === "svg") {
    const svg = await QRCode.toString(scanUrl, { type: "svg", margin: 1, width: 400 });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml" } });
  }

  const buffer = await QRCode.toBuffer(scanUrl, { type: "png", margin: 1, width: 400 });
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "image/png" } });
}
