"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";

export type MapEquipment = {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  visited: boolean;
};

export type MapPlant = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type MapScan = {
  id: string;
  latitude: number;
  longitude: number;
  scannedAt: string;
  equipmentName: string;
  userName: string;
  distanceFlag: string | null;
  photoUrls?: string[];
  notes?: string | null;
};

export type MapMaintenance = {
  id: string;
  latitude: number;
  longitude: number;
  completedAt: string;
  taskTitle: string;
  frequencyLabel: string;
  technicianName: string;
  notes?: string | null;
  photoUrls?: string[];
  reviewStatusLabel?: string | null;
};

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function plantIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:#f59e0b;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;">☀️</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function maintenanceIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:#7c3aed;border:2.5px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px;">🔧</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const visitedIcon = dotIcon("#059669");
const notVisitedIcon = dotIcon("#94a3b8");
const plantMarkerIcon = plantIcon();
const maintenanceMarkerIcon = maintenanceIcon();
const scanFlagColor: Record<string, string> = {
  ok: "#059669",
  attention: "#d97706",
  inconsistent: "#dc2626",
};

/** Fits the viewport to every equipment + scan point, even when a scan lands
 * far from the plant (e.g. test data captured somewhere else entirely). */
function FitToData({ points, fallbackCenter }: { points: [number, number][]; fallbackCenter: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      map.setView(fallbackCenter, 16);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  return null;
}

export default function PlantMap({
  center,
  plants = [],
  equipment,
  scans,
  maintenance = [],
  showTrajectory,
}: {
  center: [number, number];
  plants?: MapPlant[];
  equipment: MapEquipment[];
  scans: MapScan[];
  maintenance?: MapMaintenance[];
  showTrajectory: boolean;
}) {
  const trajectory: [number, number][] = [...scans]
    .sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime())
    .map((s) => [s.latitude, s.longitude]);

  const allPoints: [number, number][] = [
    ...plants.map((p) => [p.latitude, p.longitude] as [number, number]),
    ...equipment.map((eq) => [eq.latitude, eq.longitude] as [number, number]),
    ...scans.map((s) => [s.latitude, s.longitude] as [number, number]),
    ...maintenance.map((m) => [m.latitude, m.longitude] as [number, number]),
  ];

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitToData points={allPoints} fallbackCenter={center} />

      {plants.map((p) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={plantMarkerIcon} zIndexOffset={1000}>
          <Popup>
            <strong>☀️ {p.name}</strong>
            <br />
            Usina
          </Popup>
        </Marker>
      ))}

      {equipment.map((eq) => (
        <Marker key={eq.id} position={[eq.latitude, eq.longitude]} icon={eq.visited ? visitedIcon : notVisitedIcon}>
          <Popup>
            <strong>{eq.name}</strong>
            <br />
            {eq.code}
            <br />
            {eq.visited ? "Visitado" : "Não visitado"}
          </Popup>
        </Marker>
      ))}

      {scans.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.latitude, s.longitude]}
          radius={7}
          pathOptions={{ color: scanFlagColor[s.distanceFlag ?? "ok"], fillOpacity: 0.8 }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>{s.equipmentName}</strong>
              <br />
              {s.userName}
              <br />
              {new Date(s.scannedAt).toLocaleString("pt-BR")}
              {s.notes && (
                <>
                  <br />
                  <em>{s.notes}</em>
                </>
              )}
              {s.photoUrls && s.photoUrls.length > 0 && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.photoUrls[0]}
                    alt="Foto do registro"
                    style={{ marginTop: 6, width: "100%", maxWidth: 200, borderRadius: 6 }}
                  />
                  {s.photoUrls.length > 1 && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>+{s.photoUrls.length - 1} foto(s)</div>
                  )}
                </>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {maintenance.map((m) => (
        <Marker key={m.id} position={[m.latitude, m.longitude]} icon={maintenanceMarkerIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>🔧 {m.taskTitle}</strong>
              <br />
              {m.frequencyLabel} · {m.technicianName}
              <br />
              {new Date(m.completedAt).toLocaleString("pt-BR")}
              {m.reviewStatusLabel && (
                <>
                  <br />
                  <em>Gestor: {m.reviewStatusLabel}</em>
                </>
              )}
              {m.notes && (
                <>
                  <br />
                  <em>{m.notes}</em>
                </>
              )}
              {m.photoUrls && m.photoUrls.length > 0 && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.photoUrls[0]}
                    alt="Foto da atividade"
                    style={{ marginTop: 6, width: "100%", maxWidth: 200, borderRadius: 6 }}
                  />
                  {m.photoUrls.length > 1 && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>+{m.photoUrls.length - 1} foto(s)</div>
                  )}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {showTrajectory && trajectory.length > 1 && (
        <Polyline positions={trajectory} pathOptions={{ color: "#0f172a", weight: 3, dashArray: "6 6" }} />
      )}
    </MapContainer>
  );
}
