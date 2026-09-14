"use client";

import { useEffect, useState } from "react";

type Plant = {
  id: string;
  name: string;
  code: string;
  ownerCompany: string;
  cnpj: string | null;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  areaHectares: number | null;
  status: string;
  notes: string | null;
  _count: { equipment: number };
};

const emptyForm = {
  name: "",
  code: "",
  ownerCompany: "",
  cnpj: "",
  state: "",
  city: "",
  latitude: "",
  longitude: "",
  areaHectares: "",
  notes: "",
};

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.plants ?? []));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plant: Plant) {
    const confirmed = confirm(
      `Excluir a usina "${plant.name}" permanentemente?\n\nIsso também vai apagar TODOS os ${plant._count.equipment} equipamento(s), QR Codes, rotas, rondas, leituras e ocorrências dessa usina. Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    setDeletingId(plant.id);
    try {
      const res = await fetch(`/api/plants/${plant.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao excluir usina");
        return;
      }
      load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Usinas</h1>
          <p className="text-sm text-slate-500">Cadastro de usinas solares monitoradas</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancelar" : "+ Nova usina"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required />
          <Field label="Empresa proprietária" value={form.ownerCompany} onChange={(v) => setForm({ ...form, ownerCompany: v })} required />
          <Field label="CNPJ" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} />
          <Field label="Estado (UF)" value={form.state} onChange={(v) => setForm({ ...form, state: v })} required />
          <Field label="Município" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
          <Field label="Latitude" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} required type="number" step="any" />
          <Field label="Longitude" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} required type="number" step="any" />
          <Field label="Área (ha)" value={form.areaHectares} onChange={(v) => setForm({ ...form, areaHectares: v })} type="number" step="any" />
          <div className="md:col-span-3">
            <Field label="Observações" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          </div>
          {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar usina"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Local</th>
              <th className="px-4 py-3">Equipamentos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.code}</td>
                <td className="px-4 py-3">{p.ownerCompany}</td>
                <td className="px-4 py-3">
                  {p.city}/{p.state}
                </td>
                <td className="px-4 py-3">{p._count.equipment}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {p.status}
                  </span>
                </td>
                <td className="space-x-3 px-4 py-3 text-xs">
                  <button onClick={() => setEditingPlant(p)} className="text-slate-600 underline">
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    className="text-red-600 underline disabled:opacity-50"
                  >
                    {deletingId === p.id ? "Excluindo..." : "Excluir"}
                  </button>
                </td>
              </tr>
            ))}
            {plants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma usina cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingPlant && (
        <EditPlantModal
          plant={editingPlant}
          onClose={() => setEditingPlant(null)}
          onSaved={() => {
            setEditingPlant(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditPlantModal({ plant, onClose, onSaved }: { plant: Plant; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plant.name);
  const [ownerCompany, setOwnerCompany] = useState(plant.ownerCompany);
  const [cnpj, setCnpj] = useState(plant.cnpj ?? "");
  const [state, setState] = useState(plant.state);
  const [city, setCity] = useState(plant.city);
  const [latitude, setLatitude] = useState(String(plant.latitude));
  const [longitude, setLongitude] = useState(String(plant.longitude));
  const [areaHectares, setAreaHectares] = useState(plant.areaHectares !== null ? String(plant.areaHectares) : "");
  const [status, setStatus] = useState(plant.status);
  const [notes, setNotes] = useState(plant.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/plants/${plant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ownerCompany,
          cnpj,
          state,
          city,
          latitude: Number(latitude),
          longitude: Number(longitude),
          areaHectares: areaHectares ? Number(areaHectares) : undefined,
          status,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Editar Usina</h2>
            <p className="text-sm text-slate-500">{plant.code}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Nome" value={name} onChange={setName} required />
          <Field label="Empresa proprietária" value={ownerCompany} onChange={setOwnerCompany} required />
          <Field label="CNPJ" value={cnpj} onChange={setCnpj} />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="ATIVA">Ativa</option>
              <option value="INATIVA">Inativa</option>
              <option value="EM_CONSTRUCAO">Em construção</option>
            </select>
          </div>
          <Field label="Estado (UF)" value={state} onChange={setState} required />
          <Field label="Município" value={city} onChange={setCity} required />
          <Field label="Latitude" value={latitude} onChange={setLatitude} required type="number" step="any" />
          <Field label="Longitude" value={longitude} onChange={setLongitude} required type="number" step="any" />
          <Field label="Área (ha)" value={areaHectares} onChange={setAreaHectares} type="number" step="any" />
          <div className="md:col-span-2">
            <Field label="Observações" value={notes} onChange={setNotes} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        step={step}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
      />
    </div>
  );
}
