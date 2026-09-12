import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { pickZoom, pixelX, pixelY, TILE_SIZE } from "@/lib/webMercator";

const MAX_TILES = 64;
const TILE_SERVERS = ["a", "b", "c"];

async function fetchTile(z: number, x: number, y: number, wrapX: number): Promise<Buffer> {
  const server = TILE_SERVERS[(x + y) % TILE_SERVERS.length];
  const wrappedX = ((x % wrapX) + wrapX) % wrapX;
  const url = `https://${server}.tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "VistoriaSolar/1.0 (relatorio interno; contato via app)" },
    });
    if (!res.ok) throw new Error(`tile ${z}/${x}/${y} -> ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch {
    // Blank placeholder tile so a single failed fetch doesn't break the whole mosaic.
    return sharp({ create: { width: TILE_SIZE, height: TILE_SIZE, channels: 3, background: { r: 226, g: 232, b: 240 } } })
      .png()
      .toBuffer();
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "VIGILANTE") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const minLat = Number(searchParams.get("minLat"));
  const maxLat = Number(searchParams.get("maxLat"));
  const minLng = Number(searchParams.get("minLng"));
  const maxLng = Number(searchParams.get("maxLng"));
  const width = Math.min(Number(searchParams.get("width")) || 1000, 1400);
  const height = Math.min(Number(searchParams.get("height")) || 560, 1400);

  if ([minLat, maxLat, minLng, maxLng].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "Parâmetros de bounding box inválidos" }, { status: 400 });
  }

  const zoom = pickZoom(minLat, maxLat, minLng, maxLng, width, height);
  const wrapX = 2 ** zoom;

  const pxMinX = pixelX(minLng, zoom);
  const pxMaxX = pixelX(maxLng, zoom);
  const pxMinY = pixelY(maxLat, zoom); // north edge -> smaller y
  const pxMaxY = pixelY(minLat, zoom); // south edge -> larger y

  const tileXMin = Math.floor(pxMinX / TILE_SIZE);
  const tileXMax = Math.floor(pxMaxX / TILE_SIZE);
  const tileYMin = Math.floor(pxMinY / TILE_SIZE);
  const tileYMax = Math.floor(pxMaxY / TILE_SIZE);

  const tilesWide = tileXMax - tileXMin + 1;
  const tilesHigh = tileYMax - tileYMin + 1;
  if (tilesWide * tilesHigh > MAX_TILES || tilesWide < 1 || tilesHigh < 1) {
    return NextResponse.json({ error: "Área do mapa grande demais para gerar a imagem" }, { status: 400 });
  }

  const tileFetches: Promise<{ buffer: Buffer; left: number; top: number }>[] = [];
  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      tileFetches.push(
        fetchTile(zoom, tx, ty, wrapX).then((buffer) => ({
          buffer,
          left: (tx - tileXMin) * TILE_SIZE,
          top: (ty - tileYMin) * TILE_SIZE,
        }))
      );
    }
  }
  const tiles = await Promise.all(tileFetches);

  // Composite must be fully resolved to a real buffer before cropping — chaining
  // .extract() directly onto a pending .composite() shrinks the working canvas
  // first and sharp then rejects the (now too-large) tile overlays.
  const mosaicBuffer = await sharp({
    create: { width: tilesWide * TILE_SIZE, height: tilesHigh * TILE_SIZE, channels: 3, background: { r: 226, g: 232, b: 240 } },
  })
    .composite(tiles.map((t) => ({ input: t.buffer, left: t.left, top: t.top })))
    .png()
    .toBuffer();

  const cropLeft = Math.round(pxMinX - tileXMin * TILE_SIZE);
  const cropTop = Math.round(pxMinY - tileYMin * TILE_SIZE);
  const cropWidth = Math.max(Math.round(pxMaxX - pxMinX), 1);
  const cropHeight = Math.max(Math.round(pxMaxY - pxMinY), 1);

  const output = await sharp(mosaicBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize(Math.round(width), Math.round(height), { fit: "fill" })
    .png()
    .toBuffer();

  return new NextResponse(new Uint8Array(output), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
