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

function formatDuration(start: string, end: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const minutes = Math.round((endMs - startMs) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);

  useEffect(() => {
    fetch("/api/rounds")
      .then((r) => r.json())
      .then((d) => setRounds(d.rounds ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Rondas</h1>
        <p className="text-sm text-slate-500">Histórico de rondas realizadas pelos vigilantes</p>
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
              <tr key={r.id} className="border-b border-slate-50">
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
    </div>
  );
}
