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

export type MapScan = {
  id: string;
  latitude: number;
  longitude: number;
  scannedAt: string;
  equipmentName: string;
  userName: string;
  distanceFlag: string | null;
  photoUrl?: string | null;
  notes?: string | null;
};

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const visitedIcon = dotIcon("#059669");
const notVisitedIcon = dotIcon("#94a3b8");
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
  equipment,
  scans,
  showTrajectory,
}: {
  center: [number, number];
  equipment: MapEquipment[];
  scans: MapScan[];
  showTrajectory: boolean;
}) {
  const trajectory: [number, number][] = [...scans]
    .sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime())
    .map((s) => [s.latitude, s.longitude]);

  const allPoints: [number, number][] = [
    ...equipment.map((eq) => [eq.latitude, eq.longitude] as [number, number]),
    ...scans.map((s) => [s.latitude, s.longitude] as [number, number]),
  ];

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitToData points={allPoints} fallbackCenter={center} />

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
              {s.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.photoUrl}
                  alt="Foto do registro"
                  style={{ marginTop: 6, width: "100%", maxWidth: 200, borderRadius: 6 }}
                />
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {showTrajectory && trajectory.length > 1 && (
        <Polyline positions={trajectory} pathOptions={{ color: "#0f172a", weight: 3, dashArray: "6 6" }} />
      )}
    </MapContainer>
  );
}
