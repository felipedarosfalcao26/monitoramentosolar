"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import MultiPhotoInput from "@/components/MultiPhotoInput";
import { uploadPhotos } from "@/lib/uploadPhoto";
import {
  FREQUENCY_LABELS,
  STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  type MaintenanceFrequency,
  type MaintenanceStatus,
  type ReviewStatus,
} from "@/lib/maintenanceSchedule";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

type Plant = { id: string; name: string };

type Execution = {
  id: string;
  status: MaintenanceStatus;
  dueDate: string;
  notes: string | null;
  photoUrls: string[];
  completedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  reviewStatus: ReviewStatus | null;
  reviewNotes: string | null;
  reviewer?: { id: string; name: string } | null;
  task: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    frequency: MaintenanceFrequency;
    plant: { id: string; name: string };
    equipment: { id: string; name: string; code: string } | null;
  };
};

type Step = "loading" | "list" | "detail" | "scanning" | "locating" | "form" | "submitting" | "location-error" | "error";
type Period = "HOJE" | "SEMANA" | "MES" | "SEMESTRE" | "DATA";

const LAST_PLANT_KEY = "vistoria-solar:manutencao-last-plant-id";

const PERIOD_LABELS: Record<Period, string> = {
  HOJE: "Hoje",
  SEMANA: "Esta semana",
  MES: "Este mês",
  SEMESTRE: "Este semestre",
  DATA: "Data específica",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoRange(start: Date, end: Date) {
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Date range covered by each quick period filter, anchored on today (or a chosen date for "DATA"). */
function computePeriodRange(period: Period, customDate: string) {
  const now = period === "DATA" ? new Date(`${customDate}T12:00:00`) : new Date();

  if (period === "HOJE" || period === "DATA") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return isoRange(start, end);
  }
  if (period === "SEMANA") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return isoRange(monday, sunday);
  }
  if (period === "MES") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return isoRange(start, end);
  }
  // SEMESTRE
  const half = now.getMonth() < 6 ? 0 : 6;
  const start = new Date(now.getFullYear(), half, 1);
  const end = new Date(now.getFullYear(), half + 6, 0, 23, 59, 59, 999);
  return isoRange(start, end);
}

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

const STATUS_COLOR: Record<MaintenanceStatus, string> = {
  PENDENTE: "bg-white/10 text-slate-300",
  EM_ANDAMENTO: "bg-blue-500/20 text-blue-300",
  CONCLUIDA: "bg-emerald-500/20 text-emerald-300",
  ATRASADA: "bg-red-500/20 text-red-300",
  CANCELADA: "bg-white/5 text-slate-500",
};

const REVIEW_COLOR: Record<ReviewStatus, string> = {
  APROVADO: "bg-emerald-100 text-emerald-700",
  REPROVADO: "bg-red-100 text-red-700",
  CORRIGIR: "bg-amber-100 text-amber-700",
};

export default function MaintenancePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantId, setPlantId] = useState("");
  const [period, setPeriod] = useState<Period>("HOJE");
  const [customDate, setCustomDate] = useState(todayStr());
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selected, setSelected] = useState<Execution | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadExecutions = useCallback(async () => {
    if (period === "HOJE") {
      const params = plantId ? `?plantId=${plantId}` : "";
      const res = await fetch(`/api/maintenance/today${params}`);
      const data = await res.json();
      setExecutions(data.executions ?? []);
      return;
    }
    // Make sure today's own periods exist too, so "esta semana"/"este mês" etc. include today's due tasks.
    await fetch(`/api/maintenance/today${plantId ? `?plantId=${plantId}` : ""}`);
    const { from, to } = computePeriodRange(period, customDate);
    const params = new URLSearchParams({ from, to });
    if (plantId) params.set("plantId", plantId);
    const res = await fetch(`/api/maintenance/executions?${params.toString()}`);
    const data = await res.json();
    setExecutions(data.executions ?? []);
  }, [plantId, period, customDate]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserName(d.user?.name ?? ""));

    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => {
        const list: Plant[] = d.plants ?? [];
        setPlants(list);
        let initial = "";
        try {
          const saved = localStorage.getItem(LAST_PLANT_KEY);
          if (saved && list.some((p) => p.id === saved)) initial = saved;
        } catch {
          // ignore
        }
        setPlantId(initial);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    setStep("loading");
    loadExecutions().then(() => setStep("list"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, plantId, period, customDate]);

  function changePlant(id: string) {
    setPlantId(id);
    try {
      if (id) localStorage.setItem(LAST_PLANT_KEY, id);
      else localStorage.removeItem(LAST_PLANT_KEY);
    } catch {
      // ignore
    }
  }

  function openDetail(ex: Execution) {
    setSelected(ex);
    setQrToken(null);
    setCoords(null);
    setNotes(ex.notes ?? "");
    setPhotoFiles([]);
    setError(null);
    setStep("detail");
  }

  function backToList() {
    setSelected(null);
    setStep("list");
    loadExecutions();
  }

  async function beginExecution() {
    if (!selected) return;
    await fetch(`/api/maintenance/executions/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    if (selected.task.equipment) {
      setStep("scanning");
    } else {
      captureLocationThenForm();
    }
  }

  function captureLocationThenForm() {
    setStep("locating");
    if (!("geolocation" in navigator)) {
      setError("Este dispositivo não tem suporte a geolocalização. Não é possível concluir a atividade.");
      setStep("location-error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setStep("form");
      },
      () => {
        setError("Permissão de localização negada. Ative o GPS e permita o acesso à localização para registrar a atividade.");
        setStep("location-error");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function onQrDecode(text: string) {
    setQrToken(extractToken(text));
    captureLocationThenForm();
  }

  async function submitCompletion() {
    if (!selected || !coords) return;
    setStep("submitting");
    setError(null);

    const { urls: photoUrls, error: uploadError } = await uploadPhotos(photoFiles);
    if (uploadError) {
      setError(uploadError);
      setStep("form");
      return;
    }

    const res = await fetch(`/api/maintenance/executions/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        qrToken: qrToken ?? undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        notes: notes || undefined,
        photoUrls,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Não foi possível registrar a atividade");
      setStep("form");
      return;
    }
    openDetail({ ...selected, ...data.execution });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const pendingCount = executions.filter((e) => e.status === "PENDENTE" || e.status === "ATRASADA").length;
  const isCompleted = selected && (selected.status === "CONCLUIDA" || selected.status === "CANCELADA");
  const needsRedo = selected && (selected.reviewStatus === "CORRIGIR" || selected.reviewStatus === "REPROVADO") && !isCompleted;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-lg">🛠️</div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Técnico de Manutenção</p>
            <p className="text-sm font-medium leading-tight">{userName || "..."}</p>
          </div>
        </div>
        <button onClick={logout} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
          Sair
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-2">
        {step === "loading" && (
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-400" />
              <p className="text-sm text-slate-400">Carregando atividades...</p>
            </div>
          </div>
        )}

        {step === "list" && (
          <div className="w-full max-w-md">
            <div className="mb-4 text-center">
              <h1 className="text-xl font-semibold">Atividades — {PERIOD_LABELS[period]}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {pendingCount > 0 ? `${pendingCount} atividade(s) aguardando execução` : "Tudo em dia por aqui"}
              </p>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    period === p ? "bg-blue-500 text-white" : "bg-white/5 text-slate-300"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            {period === "DATA" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm"
              />
            )}

            {plants.length > 1 && (
              <select
                value={plantId}
                onChange={(e) => changePlant(e.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm"
              >
                <option value="">Todas as usinas</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            <div className="space-y-2.5">
              {executions.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => openDetail(ex)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition active:scale-[0.98]"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">{ex.task.plant.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[ex.status]}`}>
                      {STATUS_LABELS[ex.status]}
                    </span>
                  </div>
                  <p className="font-medium">{ex.task.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {FREQUENCY_LABELS[ex.task.frequency]}
                    {ex.task.equipment ? ` · 📷 ${ex.task.equipment.name}` : " · sem QR Code"} · prazo{" "}
                    {new Date(ex.dueDate).toLocaleDateString("pt-BR")}
                  </p>
                  {ex.reviewStatus && (
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${REVIEW_COLOR[ex.reviewStatus]}`}>
                      Gestor: {REVIEW_STATUS_LABELS[ex.reviewStatus]}
                    </span>
                  )}
                </button>
              ))}
              {executions.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">Nenhuma atividade de manutenção neste período.</p>
              )}
            </div>
          </div>
        )}

        {step === "detail" && selected && !isCompleted && (
          <div className="flex w-full max-w-md flex-1 flex-col justify-center">
            <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{STATUS_LABELS[selected.status]}</span>
              <h2 className="mt-2 text-base font-semibold">{selected.task.title}</h2>
              {selected.task.description && <p className="mt-1 text-sm text-slate-600">{selected.task.description}</p>}
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Usina" value={selected.task.plant.name} />
                <Row label="Equipamento" value={selected.task.equipment ? `${selected.task.equipment.name} (${selected.task.equipment.code})` : "Atividade geral"} />
                <Row label="Frequência" value={FREQUENCY_LABELS[selected.task.frequency]} />
                <Row label="Prazo" value={new Date(selected.dueDate).toLocaleDateString("pt-BR")} />
              </dl>
              {needsRedo && (
                <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                  <p className="font-semibold">
                    ⚠️ O gestor pediu para {selected.reviewStatus === "REPROVADO" ? "refazer" : "corrigir"} esta atividade.
                  </p>
                  {selected.reviewNotes && <p className="mt-1">{selected.reviewNotes}</p>}
                </div>
              )}
              {selected.task.equipment && (
                <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                  📷 Esta atividade exige a leitura do QR Code do equipamento no local.
                </p>
              )}
              <p className="mt-3 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-700">📍 Sua localização será registrada ao concluir.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={backToList} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700">
                  Voltar
                </button>
                <button
                  onClick={beginExecution}
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-500 active:scale-[0.98]"
                >
                  {selected.task.equipment ? "Ler QR Code" : "Iniciar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "detail" && selected && isCompleted && (
          <div className="flex w-full max-w-md flex-1 flex-col justify-center py-6">
            <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[selected.status].replace("text-slate-300", "text-slate-600").replace("bg-white/10", "bg-slate-100")}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
                {selected.reviewStatus && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_COLOR[selected.reviewStatus]}`}>
                    Gestor: {REVIEW_STATUS_LABELS[selected.reviewStatus]}
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold">{selected.task.title}</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Usina" value={selected.task.plant.name} />
                <Row label="Concluída em" value={selected.completedAt ? new Date(selected.completedAt).toLocaleString("pt-BR") : "—"} />
                <Row
                  label="Localização registrada"
                  value={selected.latitude != null && selected.longitude != null ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : "—"}
                />
              </dl>

              {selected.notes && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Observações registradas</p>
                  <p className="rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700">{selected.notes}</p>
                </div>
              )}

              {selected.photoUrls.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Fotos ({selected.photoUrls.length})</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {selected.photoUrls.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt={`Foto ${i + 1}`} className="h-20 w-full rounded-lg object-cover" />
                    ))}
                  </div>
                </div>
              )}

              {selected.reviewNotes && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Comentário do gestor</p>
                  <p className="rounded-lg bg-amber-50 p-2.5 text-sm text-amber-800">{selected.reviewNotes}</p>
                </div>
              )}

              <button onClick={backToList} className="mt-5 w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700">
                Voltar
              </button>
            </div>
          </div>
        )}

        {step === "scanning" && (
          <div className="w-full max-w-sm">
            <h2 className="mb-3 text-center text-sm text-slate-300">Posicione o QR Code do equipamento no quadro</h2>
            <QrScanner onDecode={onQrDecode} onError={(msg) => setError(msg)} />
            <button onClick={() => selected && openDetail(selected)} className="mt-4 w-full rounded-xl border border-slate-600 py-3 text-sm text-slate-300">
              Cancelar
            </button>
          </div>
        )}

        {step === "locating" && (
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-400" />
              <p className="text-sm text-slate-300">Obtendo sua localização...</p>
            </div>
          </div>
        )}

        {step === "location-error" && selected && (
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-xl">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">!</div>
            <h2 className="text-lg font-semibold">Localização necessária</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              onClick={captureLocationThenForm}
              className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-500"
            >
              Tentar novamente
            </button>
            <button onClick={() => openDetail(selected)} className="mt-2 w-full rounded-xl border border-slate-300 py-3 text-sm text-slate-700">
              Voltar
            </button>
          </div>
        )}

        {step === "form" && selected && (
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
            <h2 className="text-base font-semibold">Registrar execução</h2>
            <p className="text-sm text-slate-500">{selected.task.title}</p>
            {coords && (
              <p className="mt-1 text-xs text-emerald-600">
                📍 Localização capturada: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
              </p>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Fotos do serviço (opcional)</label>
              <MultiPhotoInput files={photoFiles} onChange={setPhotoFiles} />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">Observações / registros</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="O que foi feito, anomalias encontradas, peças trocadas..."
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button onClick={backToList} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700">
                Cancelar
              </button>
              <button
                onClick={submitCompletion}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500 active:scale-[0.98]"
              >
                Concluir atividade
              </button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />
              <p className="text-sm text-slate-300">Registrando atividade...</p>
            </div>
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
