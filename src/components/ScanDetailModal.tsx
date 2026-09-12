"use client";

const FLAG_LABEL: Record<string, string> = { ok: "OK", attention: "Atenção", inconsistent: "Inconsistente" };
const FLAG_COLOR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  attention: "bg-amber-100 text-amber-700",
  inconsistent: "bg-red-100 text-red-700",
};

export type ScanDetail = {
  id: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  distanceFlag: string | null;
  distanceFromEquipmentM: number | null;
  notes: string | null;
  photoUrl: string | null;
  user: { name: string };
  equipment: { name: string; code: string };
  plant: { name: string };
};

export default function ScanDetailModal({ scan, onClose }: { scan: ScanDetail; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Detalhes da Leitura</h2>
            <p className="text-sm text-slate-500">
              {scan.equipment.name} ({scan.equipment.code})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {scan.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scan.photoUrl} alt="Foto da leitura" className="mb-4 w-full rounded-lg object-cover" style={{ maxHeight: 320 }} />
        )}

        <dl className="space-y-2 text-sm">
          <Row label="Usina" value={scan.plant.name} />
          <Row label="Equipamento" value={`${scan.equipment.name} (${scan.equipment.code})`} />
          <Row label="Vigilante" value={scan.user.name} />
          <Row label="Data/hora" value={new Date(scan.scannedAt).toLocaleString("pt-BR")} />
          <Row label="Coordenadas" value={`${scan.latitude.toFixed(6)}, ${scan.longitude.toFixed(6)}`} />
          <Row label="Precisão GPS" value={scan.accuracyMeters ? `± ${scan.accuracyMeters.toFixed(0)} m` : "—"} />
          <Row
            label="Distância do ponto cadastrado"
            value={scan.distanceFromEquipmentM ? `${scan.distanceFromEquipmentM.toFixed(0)} m` : "—"}
          />
          <div className="flex items-center justify-between border-b border-slate-100 py-1.5">
            <dt className="text-slate-500">Status</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FLAG_COLOR[scan.distanceFlag ?? "ok"]}`}>
                {FLAG_LABEL[scan.distanceFlag ?? "ok"]}
              </span>
            </dd>
          </div>
        </dl>

        {scan.notes && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <p className="mb-1 text-xs font-medium text-slate-500">Observações</p>
            {scan.notes}
          </div>
        )}

        <a
          href={`https://www.openstreetmap.org/?mlat=${scan.latitude}&mlon=${scan.longitude}#map=18/${scan.latitude}/${scan.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-center text-sm text-emerald-700 underline"
        >
          Ver localização no OpenStreetMap
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
