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
  updatedAt: string;
  resolvedAt: string | null;
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

const SEVERITY_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const STATUS_OPTIONS = ["ABERTA", "EM_ANALISE", "EM_ANDAMENTO", "RESOLVIDA", "CANCELADA"];
const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

function brokenPhotoFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.onerror = null;
  e.currentTarget.alt = "Foto indisponível (arquivo não encontrado)";
  e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'></svg>";
}

export default function OccurrencesPage() {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Occurrence | null>(null);

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
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
  }

  async function handleDelete(o: Occurrence) {
    if (!confirm("Excluir esta ocorrência permanentemente?")) return;
    await fetch(`/api/occurrences/${o.id}`, { method: "DELETE" });
    setSelected(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ocorrências</h1>
          <p className="text-sm text-slate-500">Registros de campo feitos pelos vigilantes — clique em um card para ver detalhes</p>
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
          <button
            key={o.id}
            onClick={() => setSelected(o)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLOR[o.severity]}`}>{SEVERITY_LABEL[o.severity]}</span>
              <span className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleString("pt-BR")}</span>
            </div>
            <h3 className="font-semibold text-slate-900">{CATEGORY_LABEL[o.category] ?? o.category}</h3>
            <p className="text-xs text-slate-500">
              {o.plant.name}
              {o.equipment ? ` · ${o.equipment.name} (${o.equipment.code})` : ""}
            </p>
            {o.description && <p className="mt-2 line-clamp-2 text-sm text-slate-700">{o.description}</p>}
            {(() => {
              const photos = o.photoUrls?.length ? o.photoUrls : o.photoUrl ? [o.photoUrl] : [];
              return photos.length > 0 ? (
                <div className={`mt-2 grid gap-1.5 ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {photos.slice(0, 4).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt="Foto da ocorrência"
                      className="h-28 w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 object-cover text-xs text-slate-400"
                      onError={brokenPhotoFallback}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Sem fotos anexadas</p>
              );
            })()}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-400">Registrado por {o.user.name}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{STATUS_LABEL[o.status]}</span>
            </div>
          </button>
        ))}
        {occurrences.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-400">Nenhuma ocorrência registrada ainda.</p>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLOR[selected.severity]}`}>
                    {SEVERITY_LABEL[selected.severity]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">{CATEGORY_LABEL[selected.category] ?? selected.category}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                ✕
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Row label="Usina" value={selected.plant.name} />
              <Row label="Equipamento" value={selected.equipment ? `${selected.equipment.name} (${selected.equipment.code})` : "—"} />
              <Row label="Registrado por" value={selected.user.name} />
              <Row label="Data do registro" value={new Date(selected.createdAt).toLocaleString("pt-BR")} />
              <Row label="Última atualização" value={new Date(selected.updatedAt).toLocaleString("pt-BR")} />
              <Row label="Resolvida em" value={selected.resolvedAt ? new Date(selected.resolvedAt).toLocaleString("pt-BR") : "—"} />
            </dl>

            {selected.description && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Descrição</p>
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selected.description}</p>
              </div>
            )}

            {(() => {
              const photos = selected.photoUrls?.length ? selected.photoUrls : selected.photoUrl ? [selected.photoUrl] : [];
              return photos.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Fotos ({photos.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Foto ${i + 1} da ocorrência`}
                          className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                          onError={brokenPhotoFallback}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-400">Nenhuma foto anexada a este registro.</p>
              );
            })()}

            <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
              <select
                value={selected.status}
                onChange={(e) => updateStatus(selected.id, e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDelete(selected)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
