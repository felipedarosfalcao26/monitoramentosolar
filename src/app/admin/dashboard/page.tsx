"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then(setSummary);
    loadAlerts();
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
