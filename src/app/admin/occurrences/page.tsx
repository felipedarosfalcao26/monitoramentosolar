"use client";

import { useEffect, useState } from "react";

type Occurrence = {
  id: string;
  category: string;
  severity: string;
  description: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  status: string;
  createdAt: string;
  user: { name: string };
  equipment: { name: string; code: string } | null;
  plant: { name: string };
};

const CATEGORY_LABEL: Record<string, string> = {
  PORTAO_ABERTO: "Portão aberto",
  CERCA_DANIFICADA: "Cerca danificada",
  ILUMINACAO_APAGADA: "Iluminação apagada",
  EQUIPAMENTO_DANIFICADO: "Equipamento danificado",
  PRESENCA_TERCEIROS: "Presença de terceiros",
  VEGETACAO: "Vegetação",
  ALAGAMENTO: "Alagamento",
  FURTO_TENTATIVA: "Furto/tentativa de furto",
  ANOMALIA_OPERACIONAL: "Anomalia operacional",
  OUTRO: "Outro",
};

const SEVERITY_COLOR: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-600",
  MEDIA: "bg-amber-100 text-amber-700",
  ALTA: "bg-orange-100 text-orange-700",
  CRITICA: "bg-red-100 text-red-700",
};

const STATUS_OPTIONS = ["ABERTA", "EM_ANALISE", "EM_ANDAMENTO", "RESOLVIDA", "CANCELADA"];
const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

export default function OccurrencesPage() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/occurrences?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setOccurrences(d.occurrences ?? []));
  }

  useEffect(load, [statusFilter]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/occurrences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ocorrências</h1>
          <p className="text-sm text-slate-500">Registros de campo feitos pelos vigilantes</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {occurrences.map((o) => (
          <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLOR[o.severity]}`}>{o.severity}</span>
              <span className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleString("pt-BR")}</span>
            </div>
            <h3 className="font-semibold text-slate-900">{CATEGORY_LABEL[o.category] ?? o.category}</h3>
            <p className="text-xs text-slate-500">
              {o.plant.name}
              {o.equipment ? ` · ${o.equipment.name} (${o.equipment.code})` : ""}
            </p>
            {o.description && <p className="mt-2 text-sm text-slate-700">{o.description}</p>}
            {(() => {
              const photos = o.photoUrls?.length ? o.photoUrls : o.photoUrl ? [o.photoUrl] : [];
              return photos.length > 0 ? (
                <div className={`mt-2 grid gap-1.5 ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {photos.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={url} alt="Foto da ocorrência" className="h-28 w-full rounded-lg object-cover" />
                  ))}
                </div>
              ) : null;
            })()}
            <p className="mt-2 text-xs text-slate-400">Registrado por {o.user.name}</p>
            <select
              value={o.status}
              onChange={(e) => updateStatus(o.id, e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        ))}
        {occurrences.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-400">Nenhuma ocorrência registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
