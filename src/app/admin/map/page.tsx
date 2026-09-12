"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapEquipment, MapScan } from "@/components/PlantMap";

const PlantMap = dynamic(() => import("@/components/PlantMap"), { ssr: false });

type Plant = { id: string; name: string; latitude: number; longitude: number };
type Equipment = { id: string; name: string; code: string; latitude: number; longitude: number; plantId: string };
type Scan = {
  id: string;
  latitude: number;
  longitude: number;
  scannedAt: string;
  distanceFlag: string | null;
  equipmentId: string;
  equipment: { name: string };
  user: { name: string };
};

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: start.toISOString(), to: new Date(start.getTime() + 86400000).toISOString() };
}

export default function MapPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantId, setPlantId] = useState<string>("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [showTrajectory, setShowTrajectory] = useState(true);

  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => {
        setPlants(d.plants ?? []);
        if (d.plants?.[0]) setPlantId(d.plants[0].id);
      });
  }, []);

  useEffect(() => {
    if (!plantId) return;
    fetch(`/api/equipment?plantId=${plantId}`)
      .then((r) => r.json())
      .then((d) => setEquipment(d.equipment ?? []));

    const { from, to } = todayRange();
    fetch(`/api/scans?plantId=${plantId}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => setScans(d.scans ?? []));
  }, [plantId]);

  const visitedEquipmentIds = useMemo(() => new Set(scans.map((s) => s.equipmentId)), [scans]);
  const selectedPlant = plants.find((p) => p.id === plantId);

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
  }));

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 md:h-[calc(100vh-2rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mapa e Trajeto</h1>
          <p className="text-sm text-slate-500">Leituras de hoje — pontos visitados e trajeto percorrido</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showTrajectory} onChange={(e) => setShowTrajectory(e.target.checked)} />
            Mostrar trajeto
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <Legend color="#059669" label="Equipamento visitado" />
        <Legend color="#94a3b8" label="Equipamento não visitado" />
        <Legend color="#d97706" label="Leitura com atenção (distância)" />
        <Legend color="#dc2626" label="Leitura inconsistente" />
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        {selectedPlant && (
          <PlantMap
            center={[selectedPlant.latitude, selectedPlant.longitude]}
            equipment={mapEquipment}
            scans={mapScans}
            showTrajectory={showTrajectory}
          />
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
