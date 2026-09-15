"use client";

import { useEffect, useState } from "react";

type Round = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  plannedPoints: number;
  visitedPoints: number;
  completionPercent: number | null;
  distanceMeters: number | null;
  user: { name: string };
  plant: { name: string };
  route: { name: string } | null;
  _count: { scans: number };
};

type RoundScan = {
  id: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  distanceFromEquipmentM: number | null;
  distanceFlag: string | null;
  notes: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  equipment: { id: string; name: string; code: string };
};

type RoutePoint = { equipmentId: string; order: number; equipment: { id: string; name: string; code: string } };

type RoundDetail = Round & {
  route: ({ name: string; points: RoutePoint[] } & { name: string }) | null;
  scans: RoundScan[];
};

const FLAG_LABEL: Record<string, string> = { ok: "OK", attention: "Atenção", inconsistent: "Inconsistente" };
const FLAG_COLOR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  attention: "bg-amber-100 text-amber-700",
  inconsistent: "bg-red-100 text-red-700",
};

function formatDuration(start: string, end: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const minutes = Math.round((endMs - startMs) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

function brokenPhotoFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.onerror = null;
  e.currentTarget.alt = "Foto indisponível";
  e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'></svg>";
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selected, setSelected] = useState<RoundDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/rounds")
      .then((r) => r.json())
      .then((d) => setRounds(d.rounds ?? []));
  }, []);

  async function openRound(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/rounds/${id}`);
      const data = await res.json();
      setSelected(data.round);
    } finally {
      setLoadingDetail(false);
    }
  }

  const visitedEquipmentIds = new Set(selected?.scans.map((s) => s.equipment.id) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Rondas</h1>
        <p className="text-sm text-slate-500">Histórico de rondas realizadas pelos vigilantes — clique numa linha para ver detalhes</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Vigilante</th>
              <th className="px-4 py-3">Usina</th>
              <th className="px-4 py-3">Rota</th>
              <th className="px-4 py-3">Pontos</th>
              <th className="px-4 py-3">Conclusão</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">Distância</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr
                key={r.id}
                onClick={() => openRound(r.id)}
                className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
              >
                <td className="px-4 py-3 whitespace-nowrap">{new Date(r.startedAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{r.user.name}</td>
                <td className="px-4 py-3">{r.plant.name}</td>
                <td className="px-4 py-3">{r.route?.name ?? "Livre"}</td>
                <td className="px-4 py-3">
                  {r.visitedPoints}
                  {r.plannedPoints > 0 ? ` / ${r.plannedPoints}` : ""}
                </td>
                <td className="px-4 py-3">
                  {r.completionPercent !== null ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.completionPercent >= 100
                          ? "bg-emerald-100 text-emerald-700"
                          : r.completionPercent >= 70
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r.completionPercent}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">{formatDuration(r.startedAt, r.endedAt)}</td>
                <td className="px-4 py-3">{r.distanceMeters ? `${(r.distanceMeters / 1000).toFixed(2)} km` : "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "COMPLETED" ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {r.status === "COMPLETED" ? "Concluída" : "Em andamento"}
                  </span>
                </td>
              </tr>
            ))}
            {rounds.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma ronda registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(selected || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail && !selected && <p className="py-10 text-center text-sm text-slate-400">Carregando...</p>}
            {selected && (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Ronda de {selected.user.name} — {selected.plant.name}
                    </h2>
                    <p className="text-sm text-slate-500">{selected.route?.name ?? "Ronda livre"}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    ✕
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Row label="Início" value={new Date(selected.startedAt).toLocaleString("pt-BR")} />
                  <Row label="Fim" value={selected.endedAt ? new Date(selected.endedAt).toLocaleString("pt-BR") : "Em andamento"} />
                  <Row label="Duração" value={formatDuration(selected.startedAt, selected.endedAt)} />
                  <Row label="Pontos visitados" value={`${selected.visitedPoints}${selected.plannedPoints > 0 ? ` / ${selected.plannedPoints}` : ""}`} />
                  <Row label="Conclusão" value={selected.completionPercent !== null ? `${selected.completionPercent}%` : "—"} />
                  <Row label="Distância percorrida" value={selected.distanceMeters ? `${(selected.distanceMeters / 1000).toFixed(2)} km` : "—"} />
                </dl>

                {selected.route && selected.route.points.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Pontos da rota planejada</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.route.points.map((p) => (
                        <span
                          key={p.equipmentId}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            visitedEquipmentIds.has(p.equipmentId) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {visitedEquipmentIds.has(p.equipmentId) ? "✓" : "○"} {p.equipment.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Equipamentos inspecionados ({selected.scans.length})
                  </p>
                  <div className="space-y-2">
                    {selected.scans.map((s) => {
                      const photos = s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : [];
                      return (
                        <div key={s.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-slate-800">
                              {s.equipment.name} <span className="font-normal text-slate-400">({s.equipment.code})</span>
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">{new Date(s.scannedAt).toLocaleString("pt-BR")}</span>
                              {s.distanceFlag && (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_COLOR[s.distanceFlag]}`}>
                                  {FLAG_LABEL[s.distanceFlag]}
                                </span>
                              )}
                            </div>
                          </div>
                          {s.notes && <p className="mt-1.5 text-xs text-slate-600">{s.notes}</p>}
                          {photos.length > 0 && (
                            <div className="mt-2 grid grid-cols-4 gap-1.5">
                              {photos.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`Foto ${i + 1}`}
                                    className="h-16 w-full rounded-md border border-slate-200 object-cover"
                                    onError={brokenPhotoFallback}
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {selected.scans.length === 0 && <p className="text-sm text-slate-400">Nenhum equipamento inspecionado nesta ronda.</p>}
                  </div>
                </div>
              </>
            )}
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
