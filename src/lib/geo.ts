const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export type DistanceFlag = "ok" | "attention" | "inconsistent";

/** Sums the great-circle distance across an ordered sequence of points. */
export function pathDistanceMeters(points: { latitude: number; longitude: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceMeters(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return total;
}

export function classifyDistance(distanceMeters: number): DistanceFlag {
  const okLimit = Number(process.env.GEO_TOLERANCE_OK_METERS ?? 50);
  const attentionLimit = Number(process.env.GEO_TOLERANCE_ATTENTION_METERS ?? 100);
  if (distanceMeters <= okLimit) return "ok";
  if (distanceMeters <= attentionLimit) return "attention";
  return "inconsistent";
}
