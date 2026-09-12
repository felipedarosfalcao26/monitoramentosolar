import Dexie, { type EntityTable } from "dexie";

export type PendingScan = {
  id: string;
  qrToken: string;
  equipmentName: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  deviceInfo?: string;
  roundId?: string;
  notes?: string;
  photoUrls?: string[];
  offlineCreatedAt: string;
};

const db = new Dexie("vistoria-solar-offline") as Dexie & {
  pendingScans: EntityTable<PendingScan, "id">;
};

db.version(1).stores({
  pendingScans: "id, offlineCreatedAt",
});

export async function queueScan(scan: PendingScan) {
  await db.pendingScans.put(scan);
}

export async function listPendingScans() {
  return db.pendingScans.toArray();
}

export async function removePendingScan(id: string) {
  await db.pendingScans.delete(id);
}

/** Sends every queued scan to the server, in capture order, and drops those that succeed. */
export async function flushPendingScans(): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingScans();
  let synced = 0;
  let failed = 0;

  for (const scan of pending.sort((a, b) => a.offlineCreatedAt.localeCompare(b.offlineCreatedAt))) {
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken: scan.qrToken,
          latitude: scan.latitude,
          longitude: scan.longitude,
          accuracyMeters: scan.accuracyMeters,
          deviceInfo: scan.deviceInfo,
          roundId: scan.roundId,
          notes: scan.notes,
          photoUrls: scan.photoUrls,
          offlineCreatedAt: scan.offlineCreatedAt,
        }),
      });
      if (res.ok) {
        await removePendingScan(scan.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      break; // still offline — stop trying the rest
    }
  }

  return { synced, failed };
}
