import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";

const MAX_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Tipo de arquivo não suportado (use JPEG, PNG ou WEBP)" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 8MB" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${extension}`;

  try {
    // Production (Vercel): store in Vercel Blob — the app's own filesystem there
    // is read-only and nothing written to it would survive past the request.
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${filename}`, file, { access: "public" });
      return NextResponse.json({ url: blob.url }, { status: 201 });
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: "Armazenamento de fotos não configurado. Ative o Vercel Blob em Storage → Create Database → Blob." },
        { status: 500 }
      );
    }

    // Local dev fallback: plain disk write under public/uploads, no token needed.
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadsDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
  } catch (err) {
    console.error("upload failed", err);
    return NextResponse.json({ error: "Falha ao salvar a foto. Tente novamente." }, { status: 500 });
  }
}
