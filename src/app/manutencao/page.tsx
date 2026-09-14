"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import MultiPhotoInput from "@/components/MultiPhotoInput";
import { uploadPhotos } from "@/lib/uploadPhoto";
import { FREQUENCY_LABELS, STATUS_LABELS, type MaintenanceFrequency, type MaintenanceStatus } from "@/lib/maintenanceSchedule";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

type Execution = {
  id: string;
  status: MaintenanceStatus;
  dueDate: string;
  notes: string | null;
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

type Step = "loading" | "list" | "detail" | "scanning" | "locating" | "form" | "submitting" | "done" | "error";

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

export default function MaintenancePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [userName, setUserName] = useState("");
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selected, setSelected] = useState<Execution | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    const res = await fetch("/api/maintenance/today");
    const data = await res.json();
    setExecutions(data.executions ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserName(d.user?.name ?? ""));
    loadToday().then(() => setStep("list"));
  }, [loadToday]);

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
    loadToday();
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
      setStep("form");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setStep("form");
      },
      () => setStep("form"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function onQrDecode(text: string) {
    setQrToken(extractToken(text));
    captureLocationThenForm();
  }

  async function submitCompletion() {
    if (!selected) return;
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
        latitude: coords?.latitude,
        longitude: coords?.longitude,
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
    setStep("done");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const pendingCount = executions.filter((e) => e.status === "PENDENTE" || e.status === "ATRASADA").length;

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
            <div className="mb-5 text-center">
              <h1 className="text-xl font-semibold">Atividades de Hoje</h1>
              <p className="mt-1 text-sm text-slate-400">
                {pendingCount > 0 ? `${pendingCount} atividade(s) aguardando execução` : "Tudo em dia por aqui"}
              </p>
            </div>
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
                </button>
              ))}
              {executions.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">Nenhuma atividade de manutenção prevista para hoje.</p>
              )}
            </div>
          </div>
        )}

        {step === "detail" && selected && (
          <div className="flex w-full max-w-md flex-1 flex-col justify-center">
            <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[selected.status].replace("text-slate-300", "text-slate-600").replace("bg-white/10", "bg-slate-100")}`}>
                {STATUS_LABELS[selected.status]}
              </span>
              <h2 className="mt-2 text-base font-semibold">{selected.task.title}</h2>
              {selected.task.description && <p className="mt-1 text-sm text-slate-600">{selected.task.description}</p>}
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="Usina" value={selected.task.plant.name} />
                <Row label="Equipamento" value={selected.task.equipment ? `${selected.task.equipment.name} (${selected.task.equipment.code})` : "Atividade geral"} />
                <Row label="Frequência" value={FREQUENCY_LABELS[selected.task.frequency]} />
                <Row label="Prazo" value={new Date(selected.dueDate).toLocaleDateString("pt-BR")} />
              </dl>
              {selected.task.equipment && (
                <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                  📷 Esta atividade exige a leitura do QR Code do equipamento no local.
                </p>
              )}
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

        {step === "form" && selected && (
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
            <h2 className="text-base font-semibold">Registrar execução</h2>
            <p className="text-sm text-slate-500">{selected.task.title}</p>

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

        {step === "done" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-xl">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
                ✓
              </div>
              <h2 className="text-lg font-semibold">Atividade concluída</h2>
              <p className="mt-2 text-sm text-slate-500">Registro salvo com sucesso.</p>
              <button
                onClick={backToList}
                className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-medium text-white hover:bg-slate-800 active:scale-[0.98]"
              >
                Voltar às atividades
              </button>
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
