"use client";

import { useEffect, useState } from "react";
import ScanDetailModal, { type ScanDetail } from "@/components/ScanDetailModal";

type Plant = { id: string; name: string };
type UserOption = { id: string; name: string; role: string };

type Scan = ScanDetail & {
  id: string;
  equipmentId: string;
  round: { id: string; route: { name: string } | null } | null;
};

const FLAG_LABEL: Record<string, string> = { ok: "OK", attention: "Atenção", inconsistent: "Inconsistente" };
const FLAG_COLOR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  attention: "bg-amber-100 text-amber-700",
  inconsistent: "bg-red-100 text-red-700",
};
const REVIEW_LABEL: Record<string, string> = { APROVADO: "Aprovado", REPROVADO: "Reprovado" };
const REVIEW_COLOR: Record<string, string> = {
  APROVADO: "bg-emerald-100 text-emerald-700",
  REPROVADO: "bg-red-100 text-red-700",
};

function brokenPhotoFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.onerror = null;
  e.currentTarget.style.display = "none";
}

export default function RoundsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [vigilantes, setVigilantes] = useState<UserOption[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  const [plantId, setPlantId] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.plants ?? []));
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setVigilantes((d.users ?? []).filter((u: UserOption) => u.role === "VIGILANTE")));
  }, []);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (plantId) params.set("plantId", plantId);
    if (userId) params.set("userId", userId);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
    if (reviewStatus) params.set("reviewStatus", reviewStatus);
    fetch(`/api/scans?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setScans(d.scans ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [plantId, userId, from, to, reviewStatus]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Rondas — Pontos Vistoriados</h1>
        <p className="text-sm text-slate-500">Cada leitura de QR Code aparece individualmente — clique para ver foto, dados e avaliar</p>
      </div>

      <div className="card-shadow flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Usina</label>
          <select value={plantId} onChange={(e) => setPlantId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Vigilante</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {vigilantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Revisão</label>
          <select
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="NAO_AVALIADO">Não avaliado</option>
            <option value="APROVADO">Aprovado</option>
            <option value="REPROVADO">Reprovado</option>
          </select>
        </div>
        {(plantId || userId || from || to || reviewStatus) && (
          <button
            onClick={() => {
              setPlantId("");
              setUserId("");
              setFrom("");
              setTo("");
              setReviewStatus("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{loading ? "Carregando..." : `${scans.length} ponto(s)`}</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white card-shadow">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Foto</th>
              <th className="px-4 py-3 font-medium">Data/Hora</th>
              <th className="px-4 py-3 font-medium">Vigilante</th>
              <th className="px-4 py-3 font-medium">Equipamento</th>
              <th className="px-4 py-3 font-medium">Usina</th>
              <th className="px-4 py-3 font-medium">Ronda/Rota</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Revisão</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => {
              const photos = s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : [];
              return (
                <tr key={s.id} onClick={() => setSelectedScan(s)} className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/70">
                  <td className="px-4 py-2.5">
                    {photos.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photos[0]} alt="Foto" className="h-10 w-10 rounded-lg object-cover" onError={brokenPhotoFallback} />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-slate-100" />
                    )}
                  </td>
                  <td className="tabular-nums px-4 py-2.5 whitespace-nowrap text-slate-600">{new Date(s.scannedAt).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.user.name}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {s.equipment.name} <span className="text-slate-400">({s.equipment.code})</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{s.plant.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{s.round?.route?.name ?? (s.round ? "Ronda livre" : "—")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_COLOR[s.distanceFlag ?? "ok"]}`}>
                      {FLAG_LABEL[s.distanceFlag ?? "ok"]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {s.reviewStatus ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_COLOR[s.reviewStatus]}`}>
                        {REVIEW_LABEL[s.reviewStatus]}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Não avaliado</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && scans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhum ponto vistoriado encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedScan && (
        <ScanDetailModal scan={selectedScan} canManage onClose={() => setSelectedScan(null)} onChanged={load} />
      )}
    </div>
  );
}
