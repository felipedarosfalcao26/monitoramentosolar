"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateQrLabelSheetPdf } from "@/lib/qrLabelPdf";

type Plant = { id: string; name: string };
type Equipment = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  latitude: number;
  longitude: number;
  description: string | null;
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
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterPlantId, setFilterPlantId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [downloadingQrSheet, setDownloadingQrSheet] = useState(false);

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

  async function toggleActive(eq: Equipment) {
    setBusyId(eq.id);
    try {
      await fetch(`/api/equipment/${eq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: eq.status === "ATIVO" ? "INATIVO" : "ATIVO" }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(eq: Equipment) {
    const confirmed = confirm(
      `Excluir o equipamento "${eq.name}" (${eq.code}) permanentemente?\n\nO QR Code e o histórico de leituras desse ponto também serão apagados. Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    setBusyId(eq.id);
    try {
      const res = await fetch(`/api/equipment/${eq.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao excluir equipamento");
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  const equipmentTypesInUse = Array.from(new Set(equipment.map((eq) => eq.type))).sort();

  async function downloadQrSheet() {
    const withQr = filteredEquipment.filter((eq): eq is Equipment & { qrCode: { token: string } } => eq.qrCode !== null);
    if (withQr.length === 0) return;
    setDownloadingQrSheet(true);
    try {
      await generateQrLabelSheetPdf(
        withQr.map((eq) => ({ code: eq.code, name: eq.name, plantName: eq.plant.name, token: eq.qrCode.token }))
      );
    } finally {
      setDownloadingQrSheet(false);
    }
  }

  const filteredEquipment = equipment.filter((eq) => {
    if (filterPlantId && eq.plant.id !== filterPlantId) return false;
    if (filterType && eq.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${eq.code} ${eq.name} ${eq.type}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

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

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Usina</label>
          <select
            value={filterPlantId}
            onChange={(e) => setFilterPlantId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {equipmentTypesInUse.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Código, nome ou tipo..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {(filterPlantId || filterType || search) && (
          <button
            onClick={() => {
              setFilterPlantId("");
              setFilterType("");
              setSearch("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        )}
        <button
          onClick={downloadQrSheet}
          disabled={downloadingQrSheet || filteredEquipment.every((eq) => eq.qrCode === null)}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {downloadingQrSheet
            ? "Gerando PDF..."
            : `Baixar QR Codes (PDF) — ${filteredEquipment.filter((eq) => eq.qrCode !== null).length}`}
        </button>
      </div>

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
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredEquipment.map((eq) => (
              <tr key={eq.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium">{eq.code}</td>
                <td className="px-4 py-3">{eq.name}</td>
                <td className="px-4 py-3">{eq.type}</td>
                <td className="px-4 py-3">{eq.plant.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      eq.status === "ATIVO" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {eq.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/equipment/${eq.id}/qrcode`} className="text-emerald-700 underline">
                    Ver QR Code
                  </Link>
                </td>
                <td className="space-x-3 px-4 py-3 text-xs">
                  <button onClick={() => setEditingEquipment(eq)} className="text-slate-600 underline">
                    Editar
                  </button>
                  <button onClick={() => toggleActive(eq)} disabled={busyId === eq.id} className="text-slate-600 underline disabled:opacity-50">
                    {eq.status === "ATIVO" ? "Inativar" : "Ativar"}
                  </button>
                  <button onClick={() => handleDelete(eq)} disabled={busyId === eq.id} className="text-red-600 underline disabled:opacity-50">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {filteredEquipment.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {equipment.length === 0 ? "Nenhum equipamento cadastrado ainda." : "Nenhum equipamento corresponde aos filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingEquipment && (
        <EditEquipmentModal
          equipment={editingEquipment}
          onClose={() => setEditingEquipment(null)}
          onSaved={() => {
            setEditingEquipment(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditEquipmentModal({
  equipment,
  onClose,
  onSaved,
}: {
  equipment: Equipment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(equipment.name);
  const [type, setType] = useState(equipment.type);
  const [status, setStatus] = useState(equipment.status);
  const [latitude, setLatitude] = useState(String(equipment.latitude));
  const [longitude, setLongitude] = useState(String(equipment.longitude));
  const [description, setDescription] = useState(equipment.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/${equipment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, status, latitude: Number(latitude), longitude: Number(longitude), description }),
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Editar Equipamento</h2>
            <p className="text-sm text-slate-500">
              {equipment.code} — {equipment.plant.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Nome" value={name} onChange={setName} required />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
              <option value="MANUTENCAO">Em manutenção</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" value={latitude} onChange={setLatitude} required type="number" step="any" />
            <Field label="Longitude" value={longitude} onChange={setLongitude} required type="number" step="any" />
          </div>
          <Field label="Descrição" value={description} onChange={setDescription} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
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
