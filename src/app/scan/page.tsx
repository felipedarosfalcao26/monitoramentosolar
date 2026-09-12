"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import OccurrenceForm from "@/components/OccurrenceForm";
import MultiPhotoInput from "@/components/MultiPhotoInput";
import { uploadPhotos } from "@/lib/uploadPhoto";
import { flushPendingScans, listPendingScans, queueScan } from "@/lib/offlineQueue";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

const LAST_PLANT_KEY = "vistoria-solar:last-plant-id";
const LAST_ROUTE_KEY = "vistoria-solar:last-route-id";

type Plant = { id: string; name: string };
type RoutePoint = { equipmentId: string; order: number; equipment: { id: string; name: string; code: string } };
type RouteOption = { id: string; name: string; points: RoutePoint[] };
type Round = {
  id: string;
  plantId: string;
  routeId: string | null;
  route: RouteOption | null;
  scans: { equipmentId: string }[];
};
type Equipment = { id: string; code: string; name: string; type: string; plant: { id: string; name: string } };

type Step =
  | "loading"
  | "starting"
  | "home"
  | "scanning"
  | "resolving"
  | "locating"
  | "review"
  | "submitting"
  | "done"
  | "occurrence"
  | "ending"
  | "error";

type PendingReading = {
  token: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
};

type ScanResult = {
  scannedAt: string;
  distanceFlag: string | null;
  equipmentId: string;
};

function extractToken(raw: string): string {
  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) return fromQuery;
  } catch {
    // not a URL — treat raw text as the token itself
  }
  return raw.trim();
}

function ScanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("loading");
  const [userName, setUserName] = useState("");
  const [round, setRound] = useState<Round | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [reading, setReading] = useState<PendingReading | null>(null);
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const refreshPendingCount = useCallback(() => {
    listPendingScans().then((list) => setPendingSync(list.length));
  }, []);

  const trySync = useCallback(async () => {
    const { synced } = await flushPendingScans();
    if (synced > 0) refreshPendingCount();
  }, [refreshPendingCount]);

  const startRound = useCallback(async (plantId: string, routeId?: string) => {
    const res = await fetch("/api/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, routeId: routeId || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.round) {
        // already had one in progress — just adopt it
        const detail = await fetch(`/api/rounds/${data.round.id}`).then((r) => r.json());
        setRound(detail.round);
        setStep("home");
        return;
      }
      setError(data.error ?? "Não foi possível iniciar a ronda");
      setStep("error");
      return;
    }
    try {
      localStorage.setItem(LAST_PLANT_KEY, plantId);
      if (routeId) localStorage.setItem(LAST_ROUTE_KEY, routeId);
      else localStorage.removeItem(LAST_ROUTE_KEY);
    } catch {
      // localStorage unavailable — not critical
    }
    const detail = await fetch(`/api/rounds/${data.round.id}`).then((r) => r.json());
    setRound(detail.round);
    setStep("home");
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserName(d.user?.name ?? ""));

    Promise.all([fetch("/api/rounds").then((r) => r.json()), fetch("/api/plants").then((r) => r.json())]).then(
      async ([roundsData, plantsData]) => {
        setPlants(plantsData.plants ?? []);
        const active = (roundsData.rounds ?? []).find((r: { status: string }) => r.status === "IN_PROGRESS");
        if (active) {
          const detail = await fetch(`/api/rounds/${active.id}`).then((r) => r.json());
          setRound(detail.round);
          setStep("home");
          return;
        }

        // No round in progress: start one automatically. Prefer the vigilante's
        // last-used usina/rota; otherwise fall back to the only plant if there's
        // just one, or ask (first time / multiple usinas) via the picker below.
        const availablePlants: Plant[] = plantsData.plants ?? [];
        let lastPlantId: string | null = null;
        let lastRouteId: string | null = null;
        try {
          lastPlantId = localStorage.getItem(LAST_PLANT_KEY);
          lastRouteId = localStorage.getItem(LAST_ROUTE_KEY);
        } catch {
          // ignore
        }

        const plantToUse =
          (lastPlantId && availablePlants.find((p) => p.id === lastPlantId)?.id) ||
          (availablePlants.length === 1 ? availablePlants[0].id : null);

        if (plantToUse) {
          setSelectedPlantId(plantToUse);
          setStep("starting");
          await startRound(plantToUse, lastRouteId ?? undefined);
        } else {
          if (availablePlants[0]) setSelectedPlantId(availablePlants[0].id);
          setStep("home");
        }
      }
    );

    refreshPendingCount();
    setIsOnline(navigator.onLine);
    const onOnline = () => {
      setIsOnline(true);
      trySync();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    trySync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPlantId) return;
    fetch(`/api/routes?plantId=${selectedPlantId}`)
      .then((r) => r.json())
      .then((d) => setRoutes((d.routes ?? []).filter((r: { active: boolean }) => r.active)));
  }, [selectedPlantId]);

  async function endRound() {
    if (!round) return;
    setStep("ending");
    await fetch(`/api/rounds/${round.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    });
    setRound(null);
    clearReadingState();
    setStep("home");
  }

  function clearReadingState() {
    setEquipment(null);
    setReading(null);
    setResult(null);
    setNotes("");
    setPhotoFiles([]);
  }

  const processToken = useCallback(async (token: string) => {
    setStep("resolving");
    setError(null);
    try {
      const res = await fetch(`/api/qr/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "QR Code inválido");
        setStep("error");
        return;
      }
      setEquipment(data.equipment);
      setStep("locating");

      if (!("geolocation" in navigator)) {
        setError("Este dispositivo não tem suporte a geolocalização.");
        setStep("error");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setReading({
            token,
            capturedAt: new Date().toISOString(),
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
          setStep("review");
        },
        () => {
          setError("Permissão de localização negada. Ative o GPS para registrar a inspeção.");
          setStep("error");
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    } catch {
      setError("Falha de conexão ao validar o QR Code.");
      setStep("error");
    }
  }, []);

  async function confirmReading() {
    if (!reading || !equipment) return;
    setStep("submitting");

    const { urls: photoUrls, error: uploadError } = await uploadPhotos(photoFiles);
    if (uploadError) {
      setError(uploadError);
      setStep("error");
      return;
    }

    const payload = {
      qrToken: reading.token,
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracyMeters: reading.accuracyMeters,
      deviceInfo: navigator.userAgent,
      roundId: round?.id,
      notes: notes || undefined,
      photoUrls,
    };

    if (!navigator.onLine) {
      await queueScan({
        id: crypto.randomUUID(),
        equipmentName: equipment.name,
        offlineCreatedAt: reading.capturedAt,
        ...payload,
      });
      refreshPendingCount();
      setResult({ scannedAt: reading.capturedAt, distanceFlag: null, equipmentId: equipment.id });
      if (round) setRound({ ...round, scans: [...round.scans, { equipmentId: equipment.id }] });
      setStep("done");
      return;
    }

    try {
      const submitRes = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        setError(submitData.error ?? "Não foi possível registrar a inspeção");
        setStep("error");
        return;
      }
      setResult({
        scannedAt: submitData.scan.scannedAt,
        distanceFlag: submitData.scan.distanceFlag,
        equipmentId: submitData.scan.equipmentId,
      });
      if (round) setRound({ ...round, scans: [...round.scans, { equipmentId: submitData.scan.equipmentId }] });
      setStep("done");
    } catch {
      setError("Falha de conexão ao registrar a inspeção.");
      setStep("error");
    }
  }

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl && step === "home" && round) {
      processToken(tokenFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, round]);

  function reset() {
    setStep("home");
    clearReadingState();
    setError(null);
    router.replace("/scan");
  }

  async function logout() {
    if (round) {
      await fetch(`/api/rounds/${round.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const visitedIds = new Set(round?.scans.map((s) => s.equipmentId) ?? []);
  const totalPoints = round?.route?.points.length ?? 0;
  const visitedCount = round?.route ? round.route.points.filter((p) => visitedIds.has(p.equipmentId)).length : round?.scans.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-lg">👷</div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Vigilante</p>
            <p className="text-sm font-medium leading-tight">{userName || "..."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && <span className="rounded-full bg-red-500/20 px-2 py-1 text-[11px] font-medium text-red-300">Offline</span>}
          {pendingSync > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-300">
              {pendingSync} pendente(s)
            </span>
          )}
          <button onClick={logout} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
            Sair
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-16">
        {(step === "loading" || step === "starting") && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
            <p className="text-sm text-slate-400">{step === "starting" ? "Iniciando sua ronda..." : "Carregando..."}</p>
          </div>
        )}

        {step === "home" && !round && (
          <div className="w-full max-w-sm text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl">📍</div>
              <h1 className="text-xl font-semibold">Iniciar Ronda</h1>
              <p className="mt-1 text-sm text-slate-400">Escolha a usina e, se houver, a rota planejada</p>
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Usina</label>
                <select
                  value={selectedPlantId}
                  onChange={(e) => setSelectedPlantId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm"
                >
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Rota (opcional)</label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm"
                >
                  <option value="">Ronda livre (sem rota)</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.points.length} pontos)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => startRound(selectedPlantId, selectedRouteId || undefined)}
              disabled={!selectedPlantId}
              className="mt-6 w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              Iniciar Ronda
            </button>
          </div>
        )}

        {step === "home" && round && (
          <div className="w-full max-w-sm">
            <div className="mb-5 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">{round.route ? round.route.name : "Ronda livre"}</p>
              <h1 className="text-xl font-semibold">Ronda em andamento</h1>
              {round.route && (
                <div className="mx-auto mt-3 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${totalPoints > 0 ? (visitedCount / totalPoints) * 100 : 0}%` }}
                  />
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {round.route ? `${visitedCount} de ${totalPoints} pontos` : `${visitedCount} leitura(s) nesta ronda`}
              </p>
            </div>

            <button
              onClick={() => setStep("scanning")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              📷 Ler QR Code
            </button>

            {round.route && (
              <div className="mt-5 max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                <p className="text-xs text-slate-400">Pontos da rota</p>
                {round.route.points.map((p) => (
                  <div
                    key={p.equipmentId}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      visitedIds.has(p.equipmentId) ? "bg-emerald-500/10 text-emerald-300" : "bg-white/5 text-slate-300"
                    }`}
                  >
                    <span>{visitedIds.has(p.equipmentId) ? "✓" : "○"}</span>
                    <span>
                      {p.equipment.name} ({p.equipment.code})
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep("occurrence")}
                className="flex-1 rounded-xl border border-slate-600 py-3 text-sm text-slate-200 active:scale-[0.98]"
              >
                ⚠️ Ocorrência
              </button>
              <button
                onClick={endRound}
                className="flex-1 rounded-xl border border-red-500/50 py-3 text-sm text-red-300 active:scale-[0.98]"
              >
                Encerrar Ronda
              </button>
            </div>
          </div>
        )}

        {step === "ending" && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
            <p className="text-sm text-slate-400">Encerrando ronda...</p>
          </div>
        )}

        {step === "scanning" && (
          <div className="w-full max-w-sm">
            <h2 className="mb-3 text-center text-sm text-slate-300">Posicione o QR Code no quadro</h2>
            <QrScanner
              onDecode={(text) => processToken(extractToken(text))}
              onError={(msg) => {
                setError(msg);
                setStep("error");
              }}
            />
            <button onClick={reset} className="mt-4 w-full rounded-xl border border-slate-600 py-3 text-sm text-slate-300">
              Cancelar
            </button>
          </div>
        )}

        {(step === "resolving" || step === "locating" || step === "submitting") && (
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
            <p className="text-sm text-slate-300">
              {step === "resolving" && "Validando QR Code..."}
              {step === "locating" && "Obtendo sua localização..."}
              {step === "submitting" && "Registrando inspeção..."}
            </p>
            {equipment && <p className="mt-2 text-xs text-slate-500">{equipment.name}</p>}
          </div>
        )}

        {step === "review" && equipment && reading && (
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl sm:p-6">
            <h2 className="text-base font-semibold">Confirmar Inspeção</h2>

            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Equipamento" value={`${equipment.name} (${equipment.code})`} />
              <Row label="Usina" value={equipment.plant.name} />
              <Row label="Data/hora" value={new Date(reading.capturedAt).toLocaleString("pt-BR")} />
              <Row label="Coordenadas" value={`${reading.latitude.toFixed(6)}, ${reading.longitude.toFixed(6)}`} />
              {reading.accuracyMeters !== undefined && (
                <Row label="Precisão GPS" value={`± ${Math.round(reading.accuracyMeters)} m`} />
              )}
            </dl>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Fotos (opcional)</label>
              <MultiPhotoInput files={photoFiles} onChange={setPhotoFiles} />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Observações / Ocorrência</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Algo a registrar sobre este ponto?"
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={reset} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700">
                Descartar
              </button>
              <button
                onClick={confirmReading}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500 active:scale-[0.98]"
              >
                Registrar Inspeção
              </button>
            </div>
          </div>
        )}

        {step === "done" && equipment && result && (
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
              ✓
            </div>
            <h2 className="text-lg font-semibold">Inspeção registrada com sucesso</h2>
            <dl className="mt-4 space-y-2 text-left text-sm">
              <Row label="Equipamento" value={`${equipment.name} (${equipment.code})`} />
              <Row label="Usina" value={equipment.plant.name} />
              <Row label="Usuário" value={userName} />
              <Row label="Horário" value={new Date(result.scannedAt).toLocaleString("pt-BR")} />
              <Row
                label="Localização"
                value={
                  result.distanceFlag === null
                    ? "Será validada ao sincronizar (offline)"
                    : result.distanceFlag === "ok"
                      ? "OK"
                      : result.distanceFlag === "attention"
                        ? "Atenção — distância do ponto"
                        : "Inconsistente — muito distante do ponto"
                }
              />
            </dl>
            <button
              onClick={reset}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.98]"
            >
              Próximo QR Code
            </button>
          </div>
        )}

        {step === "occurrence" && round && (
          <OccurrenceForm
            plantId={round.plantId}
            equipmentId={equipment?.id}
            onCancel={() => setStep(equipment && result ? "done" : "home")}
            onDone={() => {
              setStep("home");
              router.replace("/scan");
            }}
          />
        )}

        {step === "error" && (
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
              !
            </div>
            <h2 className="text-lg font-semibold">Não foi possível concluir</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              onClick={reset}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <ScanPageInner />
    </Suspense>
  );
}
