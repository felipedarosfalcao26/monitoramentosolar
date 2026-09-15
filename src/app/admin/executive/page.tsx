"use client";

import { useEffect, useState } from "react";
import KpiCard from "@/components/KpiCard";
import TrendChart from "@/components/TrendChart";
import { generateExecutiveReportPdf } from "@/lib/executiveReport";
import {
  EquipmentIcon,
  MaintenanceIcon,
  OccurrenceIcon,
  PlantIcon,
  ReportIcon,
  RoundIcon,
  ShieldIcon,
} from "@/components/icons";

type ExecutiveData = {
  rangeDays: number;
  overall: {
    totalPlants: number;
    totalEquipment: number;
    activeTechnicians: number;
    activeVigilantes: number;
    scansLast30: number;
    inconsistentLast30: number;
    inconsistentRate: number;
    roundsAvgCompletion: number | null;
    occurrencesOpenTotal: number;
  };
  dailyScans: { date: string; count: number }[];
  dailyMaintenance: { date: string; count: number }[];
  occurrencesBySeverity: Record<string, number>;
  byPlant: {
    plantId: string;
    plantName: string;
    scansLast30: number;
    roundsAvgCompletion: number | null;
    occurrencesOpen: number;
    maintenanceCompleted30: number;
  }[];
};

const SEVERITY_LABEL: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", CRITICA: "Crítica" };
const SEVERITY_COLOR: Record<string, string> = { BAIXA: "#94a3b8", MEDIA: "#f59e0b", ALTA: "#ea580c", CRITICA: "#dc2626" };
const RANGE_OPTIONS = [14, 30, 90];

export default function ExecutivePage() {
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch(`/api/dashboard/executive?days=${rangeDays}`)
      .then((r) => r.json())
      .then(setData);
  }, [rangeDays]);

  async function exportPdf() {
    if (!data) return;
    setExporting(true);
    try {
      await generateExecutiveReportPdf({ generatedAt: new Date(), ...data });
    } finally {
      setExporting(false);
    }
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-accent-600" />
      </div>
    );
  }

  const maxSeverity = Math.max(...Object.values(data.occurrencesBySeverity), 1);
  const maxScans = Math.max(...data.byPlant.map((p) => p.scansLast30), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Visão Executiva</h1>
          <p className="text-sm text-slate-500">Indicadores consolidados de todas as usinas — segurança e manutenção</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {RANGE_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setRangeDays(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeDays === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            <ReportIcon className="h-4 w-4" />
            {exporting ? "Gerando..." : "Exportar PDF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Usinas monitoradas" value={data.overall.totalPlants} icon={PlantIcon} tone="slate" />
        <KpiCard label="Equipamentos" value={data.overall.totalEquipment} icon={EquipmentIcon} tone="slate" />
        <KpiCard label="Técnicos ativos" value={data.overall.activeTechnicians} icon={MaintenanceIcon} tone="violet" />
        <KpiCard label="Vigilantes ativos" value={data.overall.activeVigilantes} icon={ShieldIcon} tone="accent" />
        <KpiCard label="Leituras (30 dias)" value={data.overall.scansLast30} icon={RoundIcon} tone="emerald" />
        <KpiCard
          label="Taxa de inconsistência"
          value={`${data.overall.inconsistentRate}%`}
          icon={ShieldIcon}
          tone={data.overall.inconsistentRate > 10 ? "red" : "emerald"}
        />
        <KpiCard
          label="Conclusão média de rondas"
          value={data.overall.roundsAvgCompletion !== null ? `${data.overall.roundsAvgCompletion}%` : "—"}
          icon={RoundIcon}
          tone="accent"
        />
        <KpiCard
          label="Ocorrências em aberto"
          value={data.overall.occurrencesOpenTotal}
          icon={OccurrenceIcon}
          tone={data.overall.occurrencesOpenTotal > 0 ? "amber" : "slate"}
          href="/admin/occurrences"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Leituras de vigilância por dia</h2>
          <p className="mb-3 text-xs text-slate-400">Últimos {rangeDays} dias, todas as usinas</p>
          <TrendChart data={data.dailyScans} color="#3762e0" />
        </div>
        <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Manutenções concluídas por dia</h2>
          <p className="mb-3 text-xs text-slate-400">Últimos {rangeDays} dias, todas as usinas</p>
          <TrendChart data={data.dailyMaintenance} color="#7c3aed" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Ocorrências abertas por severidade</h2>
          <div className="space-y-2.5">
            {Object.entries(data.occurrencesBySeverity).map(([sev, count]) => (
              <div key={sev} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-slate-500">{SEVERITY_LABEL[sev]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(count / maxSeverity) * 100}%`, backgroundColor: SEVERITY_COLOR[sev] }}
                  />
                </div>
                <span className="tabular-nums w-6 shrink-0 text-right text-xs font-medium text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-shadow rounded-2xl border border-slate-200/70 bg-white p-5 md:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Comparativo por usina</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Usina</th>
                  <th className="py-2 pr-3 font-medium">Leituras (30d)</th>
                  <th className="py-2 pr-3 font-medium">Rondas</th>
                  <th className="py-2 pr-3 font-medium">Manutenção (30d)</th>
                  <th className="py-2 font-medium">Ocorrências</th>
                </tr>
              </thead>
              <tbody>
                {data.byPlant.map((p) => (
                  <tr key={p.plantId} className="border-b border-slate-50">
                    <td className="py-2.5 pr-3 font-medium text-slate-800">{p.plantName}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-accent-500" style={{ width: `${(p.scansLast30 / maxScans) * 100}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-slate-600">{p.scansLast30}</span>
                      </div>
                    </td>
                    <td className="tabular-nums py-2.5 pr-3 text-slate-600">{p.roundsAvgCompletion !== null ? `${p.roundsAvgCompletion}%` : "—"}</td>
                    <td className="tabular-nums py-2.5 pr-3 text-slate-600">{p.maintenanceCompleted30}</td>
                    <td className="py-2.5">
                      {p.occurrencesOpen > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{p.occurrencesOpen}</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">0</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.byPlant.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Nenhuma usina cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
