import Dexie, { type EntityTable } from "dexie";
import { uploadPhoto } from "./uploadPhoto";

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
  photoBlobs?: Blob[];
  offlineCreatedAt: string;
};

export type PendingOccurrence = {
  id: string;
  plantId: string;
  equipmentId?: string;
  scanId?: string;
  category: string;
  severity: string;
  description?: string;
  photoBlobs?: Blob[];
  offlineCreatedAt: string;
};

export type CachedEquipment = {
  id: string;
  code: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  plant: { id: string; name: string };
};

export type PendingMaintenance = {
  id: string;
  executionId: string;
  taskTitle: string;
  qrToken?: string;
  latitude: number;
  longitude: number;
  notes?: string;
  photoBlobs?: Blob[];
  offlineCreatedAt: string;
};

const db = new Dexie("vistoria-solar-offline") as Dexie & {
  pendingScans: EntityTable<PendingScan, "id">;
  pendingOccurrences: EntityTable<PendingOccurrence, "id">;
  pendingMaintenance: EntityTable<PendingMaintenance, "id">;
  equipmentCache: EntityTable<{ token: string; equipment: CachedEquipment }, "token">;
};

// v1 shipped with just pendingScans; v2 adds occurrences + maintenance + the
// equipment/QR lookup cache without touching existing data, so a vigilante's
// already-queued scans survive the upgrade.
db.version(1).stores({
  pendingScans: "id, offlineCreatedAt",
});
db.version(2).stores({
  pendingScans: "id, offlineCreatedAt",
  pendingOccurrences: "id, offlineCreatedAt",
  pendingMaintenance: "id, offlineCreatedAt",
  equipmentCache: "token",
});

/**
 * Every QR Code the vigilante successfully resolves online gets remembered
 * here, so re-scanning the same equipment later — even with zero signal —
 * still works: /api/qr/[token] requires network, but this local lookup
 * doesn't. It's opportunistic (only covers equipment scanned before while
 * online), not a full offline catalog.
 */
export async function cacheEquipment(token: string, equipment: CachedEquipment) {
  await db.equipmentCache.put({ token, equipment });
}

export async function getCachedEquipment(token: string): Promise<CachedEquipment | null> {
  const row = await db.equipmentCache.get(token);
  return row?.equipment ?? null;
}

/** Uploads any queued photo blobs now that we're back online, wrapping each as a real File (the API requires `instanceof File`). */
async function uploadBlobs(blobs: Blob[] | undefined): Promise<{ urls: string[]; error: string | null }> {
  if (!blobs || blobs.length === 0) return { urls: [], error: null };
  const urls: string[] = [];
  for (const blob of blobs) {
    const file = blob instanceof File ? blob : new File([blob], `foto-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
    const result = await uploadPhoto(file);
    if (!result.url) return { urls, error: result.error };
    urls.push(result.url);
  }
  return { urls, error: null };
}

// ---- Scans ----

export async function queueScan(scan: PendingScan) {
  await db.pendingScans.put(scan);
}

export async function listPendingScans() {
  return db.pendingScans.toArray();
}

export async function removePendingScan(id: string) {
  await db.pendingScans.delete(id);
}

/** Sends every queued scan to the server, in capture order (uploading any offline-captured photos first), and drops those that succeed. */
export async function flushPendingScans(): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingScans();
  let synced = 0;
  let failed = 0;

  for (const scan of pending.sort((a, b) => a.offlineCreatedAt.localeCompare(b.offlineCreatedAt))) {
    try {
      const { urls: photoUrls, error: uploadError } = await uploadBlobs(scan.photoBlobs);
      if (uploadError) {
        failed++;
        break; // still offline (or storage down) — stop trying the rest
      }

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
          photoUrls,
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

// ---- Occurrences ----

export async function queueOccurrence(occurrence: PendingOccurrence) {
  await db.pendingOccurrences.put(occurrence);
}

export async function listPendingOccurrences() {
  return db.pendingOccurrences.toArray();
}

export async function removePendingOccurrence(id: string) {
  await db.pendingOccurrences.delete(id);
}

export async function flushPendingOccurrences(): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingOccurrences();
  let synced = 0;
  let failed = 0;

  for (const occ of pending.sort((a, b) => a.offlineCreatedAt.localeCompare(b.offlineCreatedAt))) {
    try {
      const { urls: photoUrls, error: uploadError } = await uploadBlobs(occ.photoBlobs);
      if (uploadError) {
        failed++;
        break;
      }

      const res = await fetch("/api/occurrences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId: occ.plantId,
          equipmentId: occ.equipmentId,
          scanId: occ.scanId,
          category: occ.category,
          severity: occ.severity,
          description: occ.description,
          photoUrls,
        }),
      });
      if (res.ok) {
        await removePendingOccurrence(occ.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      break;
    }
  }

  return { synced, failed };
}

// ---- Maintenance executions ----

export async function queueMaintenance(execution: PendingMaintenance) {
  await db.pendingMaintenance.put(execution);
}

export async function listPendingMaintenance() {
  return db.pendingMaintenance.toArray();
}

export async function removePendingMaintenance(id: string) {
  await db.pendingMaintenance.delete(id);
}

export async function flushPendingMaintenance(): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingMaintenance();
  let synced = 0;
  let failed = 0;

  for (const item of pending.sort((a, b) => a.offlineCreatedAt.localeCompare(b.offlineCreatedAt))) {
    try {
      const { urls: photoUrls, error: uploadError } = await uploadBlobs(item.photoBlobs);
      if (uploadError) {
        failed++;
        break;
      }

      const res = await fetch(`/api/maintenance/executions/${item.executionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          qrToken: item.qrToken,
          latitude: item.latitude,
          longitude: item.longitude,
          notes: item.notes,
          photoUrls,
        }),
      });
      if (res.ok) {
        await removePendingMaintenance(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      break;
    }
  }

  return { synced, failed };
}

export async function countAllPending(): Promise<number> {
  const [scans, occurrences, maintenance] = await Promise.all([
    db.pendingScans.count(),
    db.pendingOccurrences.count(),
    db.pendingMaintenance.count(),
  ]);
  return scans + occurrences + maintenance;
}
