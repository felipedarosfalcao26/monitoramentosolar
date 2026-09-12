"use client";

import { useEffect, useState } from "react";
import { generateInspectionReportPdf } from "@/lib/pdfReport";
import ScanDetailModal from "@/components/ScanDetailModal";

type Plant = { id: string; name: string };
type EquipmentOption = { id: string; name: string; code: string; latitude: number; longitude: number };
type UserOption = { id: string; name: string; role: string };
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
  user: { id: string; name: string };
  equipment: { id: string; name: string; code: string };
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
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => {
        setPlants(d.plants ?? []);
        if (d.plants?.[0]) setPlantId(d.plants[0].id);
      });
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUserOptions((d.users ?? []).filter((u: UserOption) => u.role === "VIGILANTE")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!plantId) {
      setEquipmentOptions([]);
      return;
    }
    fetch(`/api/equipment?plantId=${plantId}`)
      .then((r) => r.json())
      .then((d) => setEquipmentOptions(d.equipment ?? []));
  }, [plantId]);

  function buildParams() {
    const params = new URLSearchParams();
    if (plantId) params.set("plantId", plantId);
    if (equipmentId) params.set("equipmentId", equipmentId);
    if (userId) params.set("userId", userId);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
    return params;
  }

  async function runReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/scans?${buildParams().toString()}`);
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

  async function generatePdf() {
    setGeneratingPdf(true);
    try {
      const params = buildParams();
      const [scansRes, roundsRes, occurrencesRes] = await Promise.all([
        fetch(`/api/scans?${params.toString()}`),
        fetch(`/api/rounds?${params.toString()}`),
        fetch(`/api/occurrences?${params.toString()}`),
      ]);
      const scansData = await scansRes.json();
      const roundsData = await roundsRes.json();
      const occurrencesData = await occurrencesRes.json();

      const plantName = plants.find((p) => p.id === plantId)?.name ?? "Todas as usinas";
      const userName = userOptions.find((u) => u.id === userId)?.name;
      const equipmentName = equipmentOptions.find((e) => e.id === equipmentId)?.name;

      await generateInspectionReportPdf({
        plantName,
        generatedAt: new Date(),
        filters: { from, to, userName, equipmentName },
        equipment: equipmentOptions,
        scans: (scansData.scans ?? []).map((s: Scan) => ({
          id: s.id,
          scannedAt: s.scannedAt,
          latitude: s.latitude,
          longitude: s.longitude,
          distanceFlag: s.distanceFlag,
          userName: s.user.name,
          equipmentName: s.equipment.name,
          equipmentCode: s.equipment.code,
          notes: s.notes,
          photoUrl: s.photoUrl,
        })),
        rounds: (roundsData.rounds ?? []).map(
          (r: {
            startedAt: string;
            endedAt: string | null;
            user: { name: string };
            route: { name: string } | null;
            plannedPoints: number;
            visitedPoints: number;
            completionPercent: number | null;
            distanceMeters: number | null;
            status: string;
          }) => ({
            startedAt: r.startedAt,
            endedAt: r.endedAt,
            userName: r.user.name,
            routeName: r.route?.name ?? null,
            plannedPoints: r.plannedPoints,
            visitedPoints: r.visitedPoints,
            completionPercent: r.completionPercent,
            distanceMeters: r.distanceMeters,
            status: r.status,
          })
        ),
        occurrences: (occurrencesData.occurrences ?? []).map(
          (o: {
            createdAt: string;
            equipment: { name: string } | null;
            category: string;
            severity: string;
            status: string;
            description: string | null;
          }) => ({
            createdAt: o.createdAt,
            equipmentName: o.equipment?.name ?? null,
            category: o.category,
            severity: o.severity,
            status: o.status,
            description: o.description,
          })
        ),
      });
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-500">Filtre por usina, período, vigilante e equipamento</p>
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
          <label className="mb-1 block text-xs font-medium text-slate-600">Vigilante</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Equipamento</label>
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {equipmentOptions.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name} ({eq.code})
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
        <button
          onClick={generatePdf}
          disabled={generatingPdf}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {generatingPdf ? "Gerando PDF..." : "Gerar Relatório PDF Completo"}
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
              <tr
                key={s.id}
                onClick={() => setSelectedScan(s)}
                className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
              >
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photoUrl} alt="Foto do registro" className="h-10 w-10 rounded object-cover" />
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

      {selectedScan && <ScanDetailModal scan={selectedScan} onClose={() => setSelectedScan(null)} />}
    </div>
  );
}
