"use client";

import { useEffect, useState } from "react";
import MultiPhotoInput from "@/components/MultiPhotoInput";
import { uploadPhotos } from "@/lib/uploadPhoto";

type Plant = { id: string; name: string };
type User = { id: string; name: string };
type Equipment = { id: string; name: string; code: string };

function nowForInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ManualScanForm({
  plants,
  vigilantes,
  onClose,
  onCreated,
}: {
  plants: Plant[];
  vigilantes: User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [plantId, setPlantId] = useState(plants[0]?.id ?? "");
  const [equipmentOptions, setEquipmentOptions] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [userId, setUserId] = useState(vigilantes[0]?.id ?? "");
  const [scannedAt, setScannedAt] = useState(nowForInput());
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;
    fetch(`/api/equipment?plantId=${plantId}`)
      .then((r) => r.json())
      .then((d) => {
        setEquipmentOptions(d.equipment ?? []);
        setEquipmentId(d.equipment?.[0]?.id ?? "");
      });
  }, [plantId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { urls: photoUrls, error: uploadError } = await uploadPhotos(photoFiles);
      if (uploadError) {
        setError(uploadError);
        return;
      }
      const res = await fetch("/api/scans/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId,
          userId,
          scannedAt: new Date(scannedAt).toISOString(),
          notes: notes || undefined,
          photoUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar registro");
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Novo registro manual</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Usina</label>
            <select value={plantId} onChange={(e) => setPlantId(e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Equipamento</label>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {equipmentOptions.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} ({eq.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Vigilante responsável</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {vigilantes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Data/hora</label>
            <input
              type="datetime-local"
              value={scannedAt}
              onChange={(e) => setScannedAt(e.target.value)}
              required
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
            <MultiPhotoInput files={photoFiles} onChange={setPhotoFiles} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <p className="text-xs text-slate-400">
            A coordenada registrada será a do equipamento selecionado (status "OK" automaticamente).
          </p>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !equipmentId || !userId}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar registro"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
