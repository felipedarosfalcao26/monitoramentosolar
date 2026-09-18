"use client";

import { useEffect, useState } from "react";

type Plant = { id: string; name: string };
type Equipment = { id: string; name: string; code: string };
type RoutePointDraft = { equipmentId: string; expectedTimeOfDay: string };
type InspectionRoute = {
  id: string;
  name: string;
  shift: string | null;
  daysOfWeek: string;
  toleranceMinutes: number;
  active: boolean;
  plant: { id: string; name: string };
  points: { order: number; expectedTimeOfDay: string | null; equipment: { id: string; name: string; code: string } }[];
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const emptyForm = { plantId: "", name: "", shift: "NOITE", toleranceMinutes: 30, daysOfWeek: [1, 2, 3, 4, 5, 6, 0] as number[] };

export default function RoutesPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [routes, setRoutes] = useState<InspectionRoute[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [points, setPoints] = useState<RoutePointDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/routes")
      .then((r) => r.json())
      .then((d) => setRoutes(d.routes ?? []));
  }

  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.plants ?? []));
    load();
  }, []);

  useEffect(() => {
    if (!form.plantId) {
      setEquipment([]);
      return;
    }
    fetch(`/api/equipment?plantId=${form.plantId}`)
      .then((r) => r.json())
      .then((d) => setEquipment(d.equipment ?? []));
  }, [form.plantId]);

  function addPoint(equipmentId: string) {
    if (!equipmentId || points.some((p) => p.equipmentId === equipmentId)) return;
    setPoints([...points, { equipmentId, expectedTimeOfDay: "" }]);
  }

  function movePoint(index: number, dir: -1 | 1) {
    const next = [...points];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPoints(next);
  }

  function removePoint(index: number) {
    setPoints(points.filter((_, i) => i !== index));
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day].sort(),
    }));
  }

  function openCreate() {
    setForm(emptyForm);
    setPoints([]);
    setEditingId(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(route: InspectionRoute) {
    setForm({
      plantId: route.plant.id,
      name: route.name,
      shift: route.shift ?? "NOITE",
      toleranceMinutes: route.toleranceMinutes,
      daysOfWeek: route.daysOfWeek.split(",").filter((d) => d !== "").map(Number),
    });
    setPoints(route.points.map((p) => ({ equipmentId: p.equipment.id, expectedTimeOfDay: p.expectedTimeOfDay ?? "" })));
    setEditingId(route.id);
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (points.length === 0) {
      setError("Adicione ao menos um ponto de inspeção à rota");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        points: points.map((p, i) => ({ equipmentId: p.equipmentId, order: i + 1, expectedTimeOfDay: p.expectedTimeOfDay || undefined })),
      };
      const res = await fetch(editingId ? `/api/routes/${editingId}` : "/api/routes", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setForm(emptyForm);
      setPoints([]);
      setEditingId(null);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(id: string) {
    await fetch(`/api/routes/${id}/duplicate`, { method: "POST" });
    load();
  }

  async function toggleActive(route: InspectionRoute) {
    await fetch(`/api/routes/${route.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !route.active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rotas Planejadas</h1>
          <p className="text-sm text-slate-500">Sequências de pontos de inspeção para as rondas</p>
        </div>
        <button
          onClick={() => (showForm ? setShowForm(false) : openCreate())}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancelar" : "+ Nova rota"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">{editingId ? "Editar rota" : "Nova rota"}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Usina</label>
              <select
                required
                disabled={!!editingId}
                value={form.plantId}
                onChange={(e) => setForm({ ...form, plantId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">Selecione...</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {editingId && <p className="mt-1 text-[11px] text-slate-400">Não é possível trocar a usina de uma rota existente.</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nome da rota</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Rota Noturna A"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Turno</label>
              <select
                value={form.shift}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="DIA">Dia</option>
                <option value="NOITE">Noite</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tolerância de horário (min)</label>
              <input
                type="number"
                value={form.toleranceMinutes}
                onChange={(e) => setForm({ ...form, toleranceMinutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    form.daysOfWeek.includes(day) ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Pontos da rota (ordem de visita)</label>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  addPoint(e.target.value);
                  e.target.value = "";
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!form.plantId}
              >
                <option value="">{form.plantId ? "Adicionar equipamento..." : "Selecione a usina primeiro"}</option>
                {equipment
                  .filter((eq) => !points.some((p) => p.equipmentId === eq.id))
                  .map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.code})
                    </option>
                  ))}
              </select>
            </div>
            <ol className="mt-3 space-y-2">
              {points.map((p, i) => {
                const eq = equipment.find((e) => e.id === p.equipmentId);
                return (
                  <li key={p.equipmentId} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="w-5 text-center font-semibold text-slate-400">{i + 1}</span>
                    <span className="flex-1">{eq ? `${eq.name} (${eq.code})` : p.equipmentId}</span>
                    <input
                      type="time"
                      value={p.expectedTimeOfDay}
                      onChange={(e) => {
                        const next = [...points];
                        next[i] = { ...next[i], expectedTimeOfDay: e.target.value };
                        setPoints(next);
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button type="button" onClick={() => movePoint(i, -1)} className="text-slate-400 hover:text-slate-700">
                      ↑
                    </button>
                    <button type="button" onClick={() => movePoint(i, 1)} className="text-slate-400 hover:text-slate-700">
                      ↓
                    </button>
                    <button type="button" onClick={() => removePoint(i)} className="text-red-500 hover:text-red-700">
                      remover
                    </button>
                  </li>
                );
              })}
              {points.length === 0 && <li className="text-xs text-slate-400">Nenhum ponto adicionado ainda.</li>}
            </ol>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar rota"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Usina</th>
              <th className="px-4 py-3">Turno</th>
              <th className="px-4 py-3">Pontos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.plant.name}</td>
                <td className="px-4 py-3">{r.shift ?? "—"}</td>
                <td className="px-4 py-3">{r.points.length}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {r.active ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="space-x-3 px-4 py-3 text-xs">
                  <button onClick={() => openEdit(r)} className="text-slate-600 underline">
                    Editar
                  </button>
                  <button onClick={() => duplicate(r.id)} className="text-slate-600 underline">
                    Duplicar
                  </button>
                  <button onClick={() => toggleActive(r)} className="text-slate-600 underline">
                    {r.active ? "Inativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
            {routes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma rota cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
