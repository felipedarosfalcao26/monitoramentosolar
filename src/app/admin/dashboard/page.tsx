"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { MapEquipment, MapPlant, MapScan } from "@/components/PlantMap";

const PlantMap = dynamic(() => import("@/components/PlantMap"), { ssr: false });

type Summary = {
  totalScans: number;
  scansToday: number;
  totalPlants: number;
  totalEquipment: number;
  totalUsers: number;
  equipmentVisitedToday: number;
  equipmentNotVisitedToday: number;
  scansByFlagToday: { flag: string; count: number }[];
  recentScans: {
    id: string;
    scannedAt: string;
    distanceFlag: string | null;
    user: { name: string };
    equipment: { name: string; code: string };
    plant: { name: string };
  }[];
};

const FLAG_LABEL: Record<string, string> = { ok: "OK", attention: "Atenção", inconsistent: "Inconsistente" };
const FLAG_COLOR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  attention: "bg-amber-100 text-amber-700",
  inconsistent: "bg-red-100 text-red-700",
};

type Alert = {
  id: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string;
  plant: { name: string };
};

const ALERT_SEVERITY_COLOR: Record<string, string> = {
  BAIXA: "border-slate-300",
  MEDIA: "border-amber-400",
  ALTA: "border-orange-500",
  CRITICA: "border-red-600",
};

type Plant = { id: string; name: string; latitude: number; longitude: number };
type Equipment = { id: string; name: string; code: string; latitude: number; longitude: number };
type Scan = {
  id: string;
  latitude: number;
  longitude: number;
  scannedAt: string;
  distanceFlag: string | null;
  equipmentId: string;
  photoUrl: string | null;
  photoUrls: string[];
  notes: string | null;
  equipment: { name: string };
  user: { name: string };
};

type MaintenanceStats = {
  total: number;
  overall: { PENDENTE: number; EM_ANDAMENTO: number; CONCLUIDA: number; ATRASADA: number; CANCELADA: number };
  byPlant: { plantId: string; plantName: string; PENDENTE: number; EM_ANDAMENTO: number; CONCLUIDA: number; ATRASADA: number }[];
  byTechnician: { userId: string; userName: string; PENDENTE: number; EM_ANDAMENTO: number; CONCLUIDA: number; ATRASADA: number }[];
};

const LIVE_REFRESH_SECONDS = 15;

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: start.toISOString(), to: new Date(start.getTime() + 86400000).toISOString() };
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceStats | null>(null);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [livePlantId, setLivePlantId] = useState("");
  const [liveEquipment, setLiveEquipment] = useState<Equipment[]>([]);
  const [liveScans, setLiveScans] = useState<Scan[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(LIVE_REFRESH_SECONDS);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then(setSummary);
    fetch("/api/maintenance/stats")
      .then((r) => r.json())
      .then(setMaintenance);
    loadAlerts();
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => {
        setPlants(d.plants ?? []);
        if (d.plants?.[0]) setLivePlantId(d.plants[0].id);
      });
  }, []);

  function loadAlerts() {
    fetch("/api/alerts?status=ABERTO")
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []));
  }

  async function resolveAlert(id: string) {
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    loadAlerts();
  }

  const loadLiveMap = useCallback(async () => {
    if (!livePlantId) return;
    const { from, to } = todayRange();
    const [eqRes, scanRes] = await Promise.all([
      fetch(`/api/equipment?plantId=${livePlantId}`),
      fetch(`/api/scans?plantId=${livePlantId}&from=${from}&to=${to}`),
    ]);
    const eqData = await eqRes.json();
    const scanData = await scanRes.json();
    setLiveEquipment(eqData.equipment ?? []);
    setLiveScans(scanData.scans ?? []);
    setLastUpdated(new Date());
    setSecondsToRefresh(LIVE_REFRESH_SECONDS);
  }, [livePlantId]);

  useEffect(() => {
    loadLiveMap();
    const refreshInterval = setInterval(loadLiveMap, LIVE_REFRESH_SECONDS * 1000);
    return () => clearInterval(refreshInterval);
  }, [loadLiveMap]);

  useEffect(() => {
    const countdown = setInterval(() => setSecondsToRefresh((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(countdown);
  }, []);

  const visitedIds = useMemo(() => new Set(liveScans.map((s) => s.equipmentId)), [liveScans]);
  const selectedLivePlant = plants.find((p) => p.id === livePlantId);
  const mapPlants: MapPlant[] = selectedLivePlant
    ? [{ id: selectedLivePlant.id, name: selectedLivePlant.name, latitude: selectedLivePlant.latitude, longitude: selectedLivePlant.longitude }]
    : [];

  const mapEquipment: MapEquipment[] = liveEquipment.map((eq) => ({
    id: eq.id,
    name: eq.name,
    code: eq.code,
    latitude: eq.latitude,
    longitude: eq.longitude,
    visited: visitedIds.has(eq.id),
  }));

  const mapScans: MapScan[] = liveScans.map((s) => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    scannedAt: s.scannedAt,
    equipmentName: s.equipment.name,
    userName: s.user.name,
    distanceFlag: s.distanceFlag,
    photoUrls: s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : [],
    notes: s.notes,
  }));

  if (!summary) {
    return <p className="text-sm text-slate-500">Carregando...</p>;
  }

  const cards = [
    { label: "Leituras hoje", value: summary.scansToday },
    { label: "Total de leituras", value: summary.totalScans },
    { label: "Pontos visitados hoje", value: summary.equipmentVisitedToday },
    { label: "Pontos não visitados hoje", value: summary.equipmentNotVisitedToday },
    { label: "Usinas cadastradas", value: summary.totalPlants },
    { label: "Equipamentos cadastrados", value: summary.totalEquipment },
    { label: "Usuários ativos", value: summary.totalUsers },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral da operação de vigilância</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-semibold text-slate-900">{c.value}</p>
            <p className="mt-1 text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      {maintenance && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">🛠️ Manutenção — atividades de hoje</h2>
            <Link href="/admin/maintenance" className="text-xs text-slate-500 underline">
              Ver plano completo
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xl font-semibold text-slate-700">{maintenance.overall.PENDENTE}</p>
              <p className="text-xs text-slate-500">Pendentes</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xl font-semibold text-blue-600">{maintenance.overall.EM_ANDAMENTO}</p>
              <p className="text-xs text-slate-500">Em andamento</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xl font-semibold text-emerald-600">{maintenance.overall.CONCLUIDA}</p>
              <p className="text-xs text-slate-500">Concluídas</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xl font-semibold text-red-600">{maintenance.overall.ATRASADA}</p>
              <p className="text-xs text-slate-500">Atrasadas</p>
            </div>
          </div>
          {(maintenance.byPlant.length > 0 || maintenance.byTechnician.length > 0) && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {maintenance.byPlant.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Por usina</p>
                  <div className="space-y-1 text-xs">
                    {maintenance.byPlant.map((p) => (
                      <div key={p.plantId} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                        <span className="text-slate-700">{p.plantName}</span>
                        <span className="text-slate-500">
                          {p.CONCLUIDA} concluídas · {p.PENDENTE + p.EM_ANDAMENTO} em aberto{p.ATRASADA > 0 ? ` · ${p.ATRASADA} atrasadas` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {maintenance.byTechnician.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Por técnico</p>
                  <div className="space-y-1 text-xs">
                    {maintenance.byTechnician.map((t) => (
                      <div key={t.userId} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                        <span className="text-slate-700">{t.userName}</span>
                        <span className="text-slate-500">
                          {t.CONCLUIDA} concluídas · {t.PENDENTE + t.EM_ANDAMENTO} em aberto{t.ATRASADA > 0 ? ` · ${t.ATRASADA} atrasadas` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">Mapa ao vivo — marcações de hoje</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={livePlantId}
              onChange={(e) => setLivePlantId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">
              {lastUpdated ? `Atualizado ${lastUpdated.toLocaleTimeString("pt-BR")}` : "Carregando..."} · próxima em {secondsToRefresh}s
            </span>
          </div>
        </div>
        <div className="h-[420px] overflow-hidden rounded-lg border border-slate-100">
          {selectedLivePlant && (
            <PlantMap
              center={[selectedLivePlant.latitude, selectedLivePlant.longitude]}
              plants={mapPlants}
              equipment={mapEquipment}
              scans={mapScans}
              showTrajectory={false}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Leituras recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-4">Horário</th>
                  <th className="py-2 pr-4">Usuário</th>
                  <th className="py-2 pr-4">Equipamento</th>
                  <th className="py-2 pr-4">Usina</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentScans.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(s.scannedAt).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-4">{s.user.name}</td>
                    <td className="py-2 pr-4">{s.equipment.name}</td>
                    <td className="py-2 pr-4">{s.plant.name}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_COLOR[s.distanceFlag ?? "ok"]}`}
                      >
                        {FLAG_LABEL[s.distanceFlag ?? "ok"]}
                      </span>
                    </td>
                  </tr>
                ))}
                {summary.recentScans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Nenhuma leitura registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Alertas abertos</h2>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className={`rounded-lg border-l-4 bg-slate-50 p-2.5 text-xs ${ALERT_SEVERITY_COLOR[a.severity]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-slate-700">{a.message}</p>
                    <button onClick={() => resolveAlert(a.id)} className="shrink-0 text-slate-400 underline hover:text-slate-600">
                      resolver
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {a.plant.name} · {new Date(a.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-xs text-slate-400">Nenhum alerta aberto no momento.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Atalhos</h2>
            <div className="space-y-2 text-sm">
              <Link href="/admin/plants" className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                + Nova usina
              </Link>
              <Link href="/admin/equipment" className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                + Novo equipamento / QR Code
              </Link>
              <Link href="/admin/routes" className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                + Nova rota de inspeção
              </Link>
              <Link href="/admin/maintenance" className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                + Nova atividade de manutenção
              </Link>
              <Link href="/admin/map" className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                Ver mapa e trajetos
              </Link>
              <Link href="/admin/reports" className="block rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                Gerar relatório
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
