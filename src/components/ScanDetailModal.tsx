"use client";

import { useState } from "react";
import MultiPhotoInput from "@/components/MultiPhotoInput";
import { uploadPhotos } from "@/lib/uploadPhoto";

const FLAG_LABEL: Record<string, string> = { ok: "OK", attention: "Atenção", inconsistent: "Inconsistente" };
const FLAG_COLOR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  attention: "bg-amber-100 text-amber-700",
  inconsistent: "bg-red-100 text-red-700",
};

export type ScanDetail = {
  id: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceFlag: string | null;
  distanceFromEquipmentM: number | null;
  notes: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  user: { name: string };
  equipment: { name: string; code: string };
  plant: { name: string };
};

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScanDetailModal({
  scan,
  onClose,
  onChanged,
  canManage = false,
}: {
  scan: ScanDetail;
  onClose: () => void;
  onChanged?: () => void;
  canManage?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(scan.notes ?? "");
  const [scannedAt, setScannedAt] = useState(toDateTimeLocal(scan.scannedAt));
  const [latitude, setLatitude] = useState(String(scan.latitude));
  const [longitude, setLongitude] = useState(String(scan.longitude));
  const [existingPhotos, setExistingPhotos] = useState<string[]>(scan.photoUrls?.length ? scan.photoUrls : scan.photoUrl ? [scan.photoUrl] : []);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photos = editing ? existingPhotos : scan.photoUrls?.length ? scan.photoUrls : scan.photoUrl ? [scan.photoUrl] : [];

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { urls: uploadedUrls, error: uploadError } = await uploadPhotos(newPhotoFiles);
      if (uploadError) {
        setError(uploadError);
        return;
      }
      const finalPhotoUrls = [...existingPhotos, ...uploadedUrls];

      const res = await fetch(`/api/scans/${scan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          scannedAt: new Date(scannedAt).toISOString(),
          latitude: Number(latitude),
          longitude: Number(longitude),
          photoUrls: finalPhotoUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar alterações");
        return;
      }
      onChanged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este registro permanentemente? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scans/${scan.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao excluir registro");
        return;
      }
      onChanged?.();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{editing ? "Editar Leitura" : "Detalhes da Leitura"}</h2>
            <p className="text-sm text-slate-500">
              {scan.equipment.name} ({scan.equipment.code})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {!editing && photos.length > 0 && (
          <div className={`mb-4 grid gap-2 ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Foto ${i + 1}`} className="w-full rounded-lg object-cover" style={{ maxHeight: 220 }} />
            ))}
          </div>
        )}

        {!editing && (
          <>
            <dl className="space-y-2 text-sm">
              <Row label="Usina" value={scan.plant.name} />
              <Row label="Equipamento" value={`${scan.equipment.name} (${scan.equipment.code})`} />
              <Row label="Vigilante" value={scan.user.name} />
              <Row label="Data/hora" value={new Date(scan.scannedAt).toLocaleString("pt-BR")} />
              <Row label="Coordenadas" value={`${scan.latitude.toFixed(6)}, ${scan.longitude.toFixed(6)}`} />
              <Row label="Precisão GPS" value={scan.accuracyMeters ? `± ${scan.accuracyMeters.toFixed(0)} m` : "—"} />
              <Row
                label="Distância do ponto cadastrado"
                value={scan.distanceFromEquipmentM ? `${scan.distanceFromEquipmentM.toFixed(0)} m` : "—"}
              />
              <div className="flex items-center justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_COLOR[scan.distanceFlag ?? "ok"]}`}>
                    {FLAG_LABEL[scan.distanceFlag ?? "ok"]}
                  </span>
                </dd>
              </div>
            </dl>

            {scan.notes && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                <p className="mb-1 text-xs font-medium text-slate-500">Observações</p>
                {scan.notes}
              </div>
            )}

            <a
              href={`https://www.openstreetmap.org/?mlat=${scan.latitude}&mlon=${scan.longitude}#map=18/${scan.latitude}/${scan.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block text-center text-sm text-emerald-700 underline"
            >
              Ver localização no OpenStreetMap
            </a>

            {canManage && (
              <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            )}
          </>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Data/hora</label>
              <input
                type="datetime-local"
                value={scannedAt}
                onChange={(e) => setScannedAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Fotos</label>
              {existingPhotos.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {existingPhotos.map((url, i) => (
                    <div key={url} className="relative h-20 w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => setExistingPhotos(existingPhotos.filter((_, idx) => idx !== i))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white shadow"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <MultiPhotoInput files={newPhotoFiles} onChange={setNewPhotoFiles} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}

        {error && !editing && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
