const TILE_SIZE = 256;

/** Longitude → fraction of world width, 0..1 */
export function worldX(lon: number): number {
  return (lon + 180) / 360;
}

/** Latitude → fraction of world height, 0..1 (Web Mercator) */
export function worldY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

export function pixelX(lon: number, zoom: number): number {
  return worldX(lon) * TILE_SIZE * 2 ** zoom;
}

export function pixelY(lat: number, zoom: number): number {
  return worldY(lat) * TILE_SIZE * 2 ** zoom;
}

/** Picks the largest zoom whose bounding-box pixel span still fits inside the target image size. */
export function pickZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  targetWidthPx: number,
  targetHeightPx: number,
  maxZoom = 18
): number {
  const xSpanWorld = Math.max(worldX(maxLng) - worldX(minLng), 1e-9);
  const ySpanWorld = Math.max(worldY(minLat) - worldY(maxLat), 1e-9);
  const zoomForWidth = Math.log2(targetWidthPx / (xSpanWorld * TILE_SIZE));
  const zoomForHeight = Math.log2(targetHeightPx / (ySpanWorld * TILE_SIZE));
  const zoom = Math.floor(Math.min(zoomForWidth, zoomForHeight));
  return Math.min(Math.max(zoom, 1), maxZoom);
}

export { TILE_SIZE };
