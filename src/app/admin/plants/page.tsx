"use client";

import { useEffect, useState } from "react";

type Plant = {
  id: string;
  name: string;
  code: string;
  ownerCompany: string;
  state: string;
  city: string;
  status: string;
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
              </tr>
            ))}
            {plants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma usina cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
