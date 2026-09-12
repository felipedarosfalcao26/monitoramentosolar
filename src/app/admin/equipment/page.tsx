"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Plant = { id: string; name: string };
type Equipment = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  plant: { id: string; name: string; code: string };
  qrCode: { token: string } | null;
};

const emptyForm = {
  plantId: "",
  code: "",
  name: "",
  type: "",
  latitude: "",
  longitude: "",
  description: "",
};

const EQUIPMENT_TYPES = [
  "Inversor",
  "Transformador",
  "Subestação",
  "String box",
  "Centro de transformação",
  "Portão",
  "Cerca",
  "Torre de iluminação",
  "Câmera",
  "Almoxarifado",
  "Outro",
];

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/equipment")
      .then((r) => r.json())
      .then((d) => setEquipment(d.equipment ?? []));
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
      const res = await fetch("/api/equipment", {
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
          <h1 className="text-xl font-semibold text-slate-900">Equipamentos / Pontos de Inspeção</h1>
          <p className="text-sm text-slate-500">Cada equipamento gera automaticamente um QR Code único</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancelar" : "+ Novo equipamento"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Usina</label>
            <select
              required
              value={form.plantId}
              onChange={(e) => setForm({ ...form, plantId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required />
          <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
            <select
              required
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Field label="Latitude" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} required type="number" step="any" />
          <Field label="Longitude" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} required type="number" step="any" />
          <div className="md:col-span-3">
            <Field label="Descrição" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          </div>
          {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar e gerar QR Code"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Usina</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">QR Code</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq) => (
              <tr key={eq.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium">{eq.code}</td>
                <td className="px-4 py-3">{eq.name}</td>
                <td className="px-4 py-3">{eq.type}</td>
                <td className="px-4 py-3">{eq.plant.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {eq.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/equipment/${eq.id}/qrcode`} className="text-emerald-700 underline">
                    Ver QR Code
                  </Link>
                </td>
              </tr>
            ))}
            {equipment.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum equipamento cadastrado ainda.
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
