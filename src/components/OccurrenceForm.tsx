"use client";

import { useState } from "react";
import { uploadPhotos } from "@/lib/uploadPhoto";
import { queueOccurrence } from "@/lib/offlineQueue";
import MultiPhotoInput from "@/components/MultiPhotoInput";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "PORTAO_ABERTO", label: "Portão aberto" },
  { value: "CERCA_DANIFICADA", label: "Cerca danificada" },
  { value: "ILUMINACAO_APAGADA", label: "Iluminação apagada" },
  { value: "EQUIPAMENTO_DANIFICADO", label: "Equipamento danificado" },
  { value: "PRESENCA_TERCEIROS", label: "Presença de terceiros" },
  { value: "VEGETACAO", label: "Vegetação" },
  { value: "ALAGAMENTO", label: "Alagamento" },
  { value: "FURTO_TENTATIVA", label: "Furto/tentativa de furto" },
  { value: "ANOMALIA_OPERACIONAL", label: "Anomalia operacional" },
  { value: "OUTRO", label: "Outro" },
];

export default function OccurrenceForm({
  plantId,
  equipmentId,
  scanId,
  onDone,
  onCancel,
}: {
  plantId: string;
  equipmentId?: string;
  scanId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState("OUTRO");
  const [severity, setSeverity] = useState("MEDIA");
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function queueOffline() {
    await queueOccurrence({
      id: crypto.randomUUID(),
      plantId,
      equipmentId,
      scanId,
      category,
      severity,
      description: description || undefined,
      photoBlobs: photoFiles,
      offlineCreatedAt: new Date().toISOString(),
    });
    onDone();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Offline-first: never require network just to queue the occurrence —
      // photos are only uploaded here on the online path.
      if (!navigator.onLine) {
        await queueOffline();
        return;
      }

      const { urls: photoUrls, error: uploadError } = await uploadPhotos(photoFiles);
      if (uploadError) {
        await queueOffline();
        return;
      }

      const res = await fetch("/api/occurrences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, equipmentId, scanId, category, severity, description, photoUrls }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao registrar ocorrência");
        return;
      }
      onDone();
    } catch {
      await queueOffline();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
      <h2 className="text-base font-semibold">Registrar Ocorrência</h2>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Categoria</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Severidade</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="CRITICA">Crítica</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="O que você encontrou?"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Fotos (opcional)</label>
        <MultiPhotoInput files={photoFiles} onChange={setPhotoFiles} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Enviando..." : "Registrar"}
        </button>
      </div>
    </form>
  );
}
