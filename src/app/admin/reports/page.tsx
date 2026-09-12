"use client";

import { useEffect, useState } from "react";

type Plant = { id: string; name: string };
type Scan = {
  id: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceFlag: string | null;
  distanceFromEquipmentM: number | null;
  notes: string | null;
  photoUrl: string | null;
  user: { name: string };
  equipment: { name: string; code: string };
  plant: { name: string };
};

const FLAG_LABEL: Record<string, string> = { ok: "OK", attention: "Atenção", inconsistent: "Inconsistente" };

function toCsv(scans: Scan[]): string {
  const header = [
    "Data",
    "Hora",
    "Usuário",
    "Usina",
    "Equipamento",
    "Código",
    "Latitude",
    "Longitude",
    "Precisão (m)",
    "Distância do ponto (m)",
    "Status",
    "Observações",
  ];
  const rows = scans.map((s) => {
    const date = new Date(s.scannedAt);
    return [
      date.toLocaleDateString("pt-BR"),
      date.toLocaleTimeString("pt-BR"),
      s.user.name,
      s.plant.name,
      s.equipment.name,
      s.equipment.code,
      s.latitude.toFixed(6),
      s.longitude.toFixed(6),
      s.accuracyMeters?.toFixed(1) ?? "",
      s.distanceFromEquipmentM?.toFixed(1) ?? "",
      FLAG_LABEL[s.distanceFlag ?? "ok"],
      (s.notes ?? "").replace(/[\r\n,]/g, " "),
    ].join(";");
  });
  return [header.join(";"), ...rows].join("\n");
}

export default function ReportsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantId, setPlantId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.plants ?? []));
  }, []);

  async function runReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (plantId) params.set("plantId", plantId);
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      const res = await fetch(`/api/scans?${params.toString()}`);
      const data = await res.json();
      setScans(data.scans ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    const csv = toCsv(scans);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-leituras-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Relatório de Leituras</h1>
        <p className="text-sm text-slate-500">Filtre por usina e período e exporte os dados</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
          <label className="mb-1 block text-xs font-medium text-slate-600">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button onClick={runReport} disabled={loading} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          {loading ? "Carregando..." : "Filtrar"}
        </button>
        <button
          onClick={exportCsv}
          disabled={scans.length === 0}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <th className="px-4 py-3">Data/Hora</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Usina</th>
              <th className="px-4 py-3">Equipamento</th>
              <th className="px-4 py-3">Precisão GPS</th>
              <th className="px-4 py-3">Distância</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Observações</th>
              <th className="px-4 py-3">Foto</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">{new Date(s.scannedAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{s.user.name}</td>
                <td className="px-4 py-3">{s.plant.name}</td>
                <td className="px-4 py-3">
                  {s.equipment.name} ({s.equipment.code})
                </td>
                <td className="px-4 py-3">{s.accuracyMeters ? `${s.accuracyMeters.toFixed(0)} m` : "—"}</td>
                <td className="px-4 py-3">{s.distanceFromEquipmentM ? `${s.distanceFromEquipmentM.toFixed(0)} m` : "—"}</td>
                <td className="px-4 py-3">{FLAG_LABEL[s.distanceFlag ?? "ok"]}</td>
                <td className="max-w-[200px] px-4 py-3 truncate" title={s.notes ?? ""}>
                  {s.notes ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {s.photoUrl ? (
                    <a href={s.photoUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.photoUrl} alt="Foto do registro" className="h-10 w-10 rounded object-cover hover:opacity-80" />
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {scans.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma leitura encontrada para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
