"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { MapEquipment, MapMaintenance, MapPlant, MapScan } from "@/components/PlantMap";
import { FREQUENCY_LABELS, REVIEW_STATUS_LABELS, type MaintenanceFrequency, type ReviewStatus } from "@/lib/maintenanceSchedule";
import KpiCard from "@/components/KpiCard";
import {
  DashboardIcon,
  EquipmentIcon,
  MaintenanceIcon,
  OccurrenceIcon,
  PlantIcon,
  RouteIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";

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
  ok: "bg-emerald-50 text-emerald-700",
  attention: "bg-amber-50 text-amber-700",
  inconsistent: "bg-red-50 text-red-700",
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

type LiveMaintenanceExecution = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  completedAt: string | null;
  notes: string | null;
  photoUrls: string[];
  reviewStatus: ReviewStatus | null;
  user: { id: string; name: string } | null;
  task: { title: string; frequency: MaintenanceFrequency };
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
  const [liveMaintenance, setLiveMaintenance] = useState<LiveMaintenanceExecution[]>([]);
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
    const [eqRes, scanRes, maintRes] = await Promise.all([
      fetch(`/api/equipment?plantId=${livePlantId}`),
      fetch(`/api/scans?plantId=${livePlantId}&from=${from}&to=${to}`),
      fetch(`/api/maintenance/executions?plantId=${livePlantId}&from=${from}&to=${to}&status=CONCLUIDA`),
    ]);
    const eqData = await eqRes.json();
    const scanData = await scanRes.json();
    const maintData = await maintRes.json();
    setLiveEquipment(eqData.equipment ?? []);
    setLiveScans(scanData.scans ?? []);
    setLiveMaintenance(maintData.executions ?? []);
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

  const mapMaintenance: MapMaintenance[] = liveMaintenance
    .filter((m): m is LiveMaintenanceExecution & { latitude: number; longitude: number; completedAt: string } =>
      m.latitude != null && m.longitude != null && m.completedAt != null
    )
    .map((m) => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      completedAt: m.completedAt,
      taskTitle: m.task.title,
      frequencyLabel: FREQUENCY_LABELS[m.task.frequency],
      technicianName: m.user?.name ?? "—",
      notes: m.notes,
      photoUrls: m.photoUrls,
      reviewStatusLabel: m.reviewStatus ? REVIEW_STATUS_LABELS[m.reviewStatus] : null,
    }));

  if (!summary) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-accent-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Visão geral da operação em tempo real</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Leituras hoje" value={summary.scansToday} icon={ShieldIcon} tone="accent" />
        <KpiCard label="Total de leituras" value={summary.totalScans} icon={DashboardIcon} tone="slate" />
        <KpiCard label="Pontos visitados hoje" value={summary.equipmentVisitedToday} icon={EquipmentIcon} tone="emerald" />
        <KpiCard label="Pontos não visitados hoje" value={summary.equipmentNotVisitedToday} icon={EquipmentIcon} tone="amber" />
        <KpiCard label="Usinas cadastradas" value={summary.totalPlants} icon={PlantIcon} tone="slate" href="/admin/plants" />
        <KpiCard label="Equipamentos cadastrados" value={summary.totalEquipment} icon={RouteIcon} tone="slate" href="/admin/equipment" />
        <KpiCard label="Usuários ativos" value={summary.totalUsers} icon={UsersIcon} tone="slate" href="/admin/users" />
        <KpiCard label="Alertas abertos" value={alerts.length} icon={OccurrenceIcon} tone={alerts.length > 0 ? "red" : "slate"} />
      </div>

      {maintenance && (
        <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <MaintenanceIcon className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Manutenção — atividades de hoje</h2>
            </div>
            <Link href="/admin/maintenance" className="text-xs font-medium text-accent-600 hover:text-accent-700">
              Ver plano completo →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="tabular-nums text-xl font-semibold text-slate-700">{maintenance.overall.PENDENTE}</p>
              <p className="text-xs text-slate-500">Pendentes</p>
            </div>
            <div className="rounded-xl bg-accent-50 p-3">
              <p className="tabular-nums text-xl font-semibold text-accent-600">{maintenance.overall.EM_ANDAMENTO}</p>
              <p className="text-xs text-slate-500">Em andamento</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="tabular-nums text-xl font-semibold text-emerald-600">{maintenance.overall.CONCLUIDA}</p>
              <p className="text-xs text-slate-500">Concluídas</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="tabular-nums text-xl font-semibold text-red-600">{maintenance.overall.ATRASADA}</p>
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

      <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-4">
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
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            >
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="tabular-nums text-xs text-slate-400">
              {lastUpdated ? `Atualizado ${lastUpdated.toLocaleTimeString("pt-BR")}` : "Carregando..."} · próxima em {secondsToRefresh}s
            </span>
          </div>
        </div>
        <div className="h-[420px] overflow-hidden rounded-xl border border-slate-100">
          {selectedLivePlant && (
            <PlantMap
              center={[selectedLivePlant.latitude, selectedLivePlant.longitude]}
              plants={mapPlants}
              equipment={mapEquipment}
              scans={mapScans}
              maintenance={mapMaintenance}
              showTrajectory={false}
            />
          )}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Manutenção executada hoje
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Leituras recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">Horário</th>
                  <th className="py-2 pr-4 font-medium">Usuário</th>
                  <th className="py-2 pr-4 font-medium">Equipamento</th>
                  <th className="py-2 pr-4 font-medium">Usina</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentScans.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/70">
                    <td className="tabular-nums py-2 pr-4 whitespace-nowrap text-slate-600">{new Date(s.scannedAt).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-4 text-slate-700">{s.user.name}</td>
                    <td className="py-2 pr-4 text-slate-700">{s.equipment.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{s.plant.name}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_COLOR[s.distanceFlag ?? "ok"]}`}>
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
          <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Alertas abertos</h2>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className={`rounded-lg border-l-4 bg-slate-50 p-2.5 text-xs ${ALERT_SEVERITY_COLOR[a.severity]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-slate-700">{a.message}</p>
                    <button onClick={() => resolveAlert(a.id)} className="shrink-0 font-medium text-accent-600 hover:text-accent-700">
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

          <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Atalhos</h2>
            <div className="space-y-1.5 text-sm">
              <Link
                href="/admin/plants"
                className="block rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition-colors hover:border-accent-200 hover:bg-accent-50/60"
              >
                + Nova usina
              </Link>
              <Link
                href="/admin/equipment"
                className="block rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition-colors hover:border-accent-200 hover:bg-accent-50/60"
              >
                + Novo equipamento / QR Code
              </Link>
              <Link
                href="/admin/routes"
                className="block rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition-colors hover:border-accent-200 hover:bg-accent-50/60"
              >
                + Nova rota de inspeção
              </Link>
              <Link
                href="/admin/maintenance"
                className="block rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition-colors hover:border-accent-200 hover:bg-accent-50/60"
              >
                + Nova atividade de manutenção
              </Link>
              <Link
                href="/admin/map"
                className="block rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition-colors hover:border-accent-200 hover:bg-accent-50/60"
              >
                Ver mapa e trajetos
              </Link>
              <Link
                href="/admin/reports"
                className="block rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition-colors hover:border-accent-200 hover:bg-accent-50/60"
              >
                Gerar relatório
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
