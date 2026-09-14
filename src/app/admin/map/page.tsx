"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapEquipment, MapMaintenance, MapPlant, MapScan } from "@/components/PlantMap";
import { FREQUENCY_LABELS, REVIEW_STATUS_LABELS, type MaintenanceFrequency, type ReviewStatus } from "@/lib/maintenanceSchedule";

const PlantMap = dynamic(() => import("@/components/PlantMap"), { ssr: false });

type Plant = { id: string; name: string; latitude: number; longitude: number };
type Equipment = { id: string; name: string; code: string; latitude: number; longitude: number; plantId: string };
type UserOption = { id: string; name: string; role: string };
type Scan = {
  id: string;
  latitude: number;
  longitude: number;
  scannedAt: string;
  distanceFlag: string | null;
  equipmentId: string;
  photoUrl: string | null;
  photoUrls: string[];
  notes: string | null;
  equipment: { name: string };
  user: { name: string };
};
type MaintenanceExecution = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  completedAt: string | null;
  notes: string | null;
  photoUrls: string[];
  reviewStatus: ReviewStatus | null;
  user: { id: string; name: string } | null;
  task: { title: string; frequency: MaintenanceFrequency };
};

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { from: start.toISOString(), to: end.toISOString() };
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MapPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantId, setPlantId] = useState<string>("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [maintenanceExecutions, setMaintenanceExecutions] = useState<MaintenanceExecution[]>([]);
  const [showTrajectory, setShowTrajectory] = useState(true);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [date, setDate] = useState(todayStr());
  const [vigilanteId, setVigilanteId] = useState("");
  const [technicianId, setTechnicianId] = useState("");

  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => {
        setPlants(d.plants ?? []);
        if (d.plants?.[0]) setPlantId(d.plants[0].id);
      });
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, []);

  useEffect(() => {
    if (!plantId) return;
    fetch(`/api/equipment?plantId=${plantId}`)
      .then((r) => r.json())
      .then((d) => setEquipment(d.equipment ?? []));
  }, [plantId]);

  useEffect(() => {
    if (!plantId) return;
    const { from, to } = dayRange(date);
    const scanParams = new URLSearchParams({ plantId, from, to });
    if (vigilanteId) scanParams.set("userId", vigilanteId);
    fetch(`/api/scans?${scanParams.toString()}`)
      .then((r) => r.json())
      .then((d) => setScans(d.scans ?? []));

    const maintParams = new URLSearchParams({ plantId, from, to, status: "CONCLUIDA" });
    if (technicianId) maintParams.set("userId", technicianId);
    fetch(`/api/maintenance/executions?${maintParams.toString()}`)
      .then((r) => r.json())
      .then((d) => setMaintenanceExecutions(d.executions ?? []));
  }, [plantId, date, vigilanteId, technicianId]);

  const vigilantes = useMemo(() => users.filter((u) => u.role === "VIGILANTE"), [users]);
  const technicians = useMemo(() => users.filter((u) => u.role === "TECNICO_MANUTENCAO"), [users]);

  const visitedEquipmentIds = useMemo(() => new Set(scans.map((s) => s.equipmentId)), [scans]);
  const selectedPlant = plants.find((p) => p.id === plantId);
  const mapPlants: MapPlant[] = selectedPlant
    ? [{ id: selectedPlant.id, name: selectedPlant.name, latitude: selectedPlant.latitude, longitude: selectedPlant.longitude }]
    : [];

  const mapEquipment: MapEquipment[] = equipment.map((eq) => ({
    id: eq.id,
    name: eq.name,
    code: eq.code,
    latitude: eq.latitude,
    longitude: eq.longitude,
    visited: visitedEquipmentIds.has(eq.id),
  }));

  const mapScans: MapScan[] = scans.map((s) => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    scannedAt: s.scannedAt,
    equipmentName: s.equipment.name,
    userName: s.user.name,
    distanceFlag: s.distanceFlag,
    photoUrls: s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : [],
    notes: s.notes,
  }));

  const mapMaintenance: MapMaintenance[] = maintenanceExecutions
    .filter((m): m is MaintenanceExecution & { latitude: number; longitude: number; completedAt: string } =>
      m.latitude != null && m.longitude != null && m.completedAt != null
    )
    .map((m) => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      completedAt: m.completedAt,
      taskTitle: m.task.title,
      frequencyLabel: FREQUENCY_LABELS[m.task.frequency],
      technicianName: m.user?.name ?? "—",
      notes: m.notes,
      photoUrls: m.photoUrls,
      reviewStatusLabel: m.reviewStatus ? REVIEW_STATUS_LABELS[m.reviewStatus] : null,
    }));

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 md:h-[calc(100vh-2rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mapa e Trajeto</h1>
          <p className="text-sm text-slate-500">Leituras de vigilância e execuções de manutenção no dia selecionado</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <MapFilterField label="Usina">
          <select value={plantId} onChange={(e) => setPlantId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </MapFilterField>
        <MapFilterField label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </MapFilterField>
        <MapFilterField label="Vigilante">
          <select value={vigilanteId} onChange={(e) => setVigilanteId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {vigilantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </MapFilterField>
        <MapFilterField label="Técnico">
          <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </MapFilterField>
        {date !== todayStr() && (
          <button onClick={() => setDate(todayStr())} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            Voltar para hoje
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showTrajectory} onChange={(e) => setShowTrajectory(e.target.checked)} />
          Mostrar trajeto
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <Legend color="#f59e0b" label="Usina" emoji="☀️" />
        <Legend color="#059669" label="Equipamento visitado" />
        <Legend color="#94a3b8" label="Equipamento não visitado" />
        <Legend color="#d97706" label="Leitura com atenção (distância)" />
        <Legend color="#dc2626" label="Leitura inconsistente" />
        <Legend color="#7c3aed" label="Manutenção executada" emoji="🔧" />
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        {selectedPlant && (
          <PlantMap
            center={[selectedPlant.latitude, selectedPlant.longitude]}
            plants={mapPlants}
            equipment={mapEquipment}
            scans={mapScans}
            maintenance={mapMaintenance}
            showTrajectory={showTrajectory}
          />
        )}
      </div>
    </div>
  );
}

function MapFilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Legend({ color, label, emoji }: { color: string; label: string; emoji?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full text-[6px]" style={{ backgroundColor: color }}>
        {emoji}
      </span>
      {label}
    </div>
  );
}
