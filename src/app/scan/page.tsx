"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

type Equipment = {
  id: string;
  code: string;
  name: string;
  type: string;
  plant: { id: string; name: string };
};

type Step = "home" | "scanning" | "resolving" | "locating" | "submitting" | "done" | "error";

type ScanResult = {
  scannedAt: string;
  distanceFlag: string | null;
  accuracyMeters: number | null;
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
  const [step, setStep] = useState<Step>("home");
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserName(d.user?.name ?? ""));
  }, []);

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
        async (position) => {
          setStep("submitting");
          try {
            const submitRes = await fetch("/api/scans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                qrToken: token,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMeters: position.coords.accuracy,
                deviceInfo: navigator.userAgent,
              }),
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
              accuracyMeters: submitData.scan.accuracyMeters,
            });
            setStep("done");
          } catch {
            setError("Falha de conexão ao registrar a inspeção.");
            setStep("error");
          }
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

  useEffect(() => {
    const tokenFromUrl = searchParams.get("token");
    if (tokenFromUrl && step === "home") {
      processToken(tokenFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function reset() {
    setStep("home");
    setEquipment(null);
    setResult(null);
    setError(null);
    router.replace("/scan");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-xs text-slate-400">Vigilante</p>
          <p className="text-sm font-medium">{userName || "..."}</p>
        </div>
        <button onClick={logout} className="text-xs text-slate-400 underline">
          Sair
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        {step === "home" && (
          <div className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
                📍
              </div>
              <h1 className="text-xl font-semibold">Iniciar Ronda</h1>
              <p className="mt-1 text-sm text-slate-400">
                Aponte a câmera para o QR Code do ponto de inspeção
              </p>
            </div>
            <button
              onClick={() => setStep("scanning")}
              className="w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-emerald-400"
            >
              Ler QR Code
            </button>
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
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-emerald-400" />
            <p className="text-sm text-slate-300">
              {step === "resolving" && "Validando QR Code..."}
              {step === "locating" && "Obtendo sua localização..."}
              {step === "submitting" && "Registrando inspeção..."}
            </p>
            {equipment && <p className="mt-2 text-xs text-slate-500">{equipment.name}</p>}
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
                  result.distanceFlag === "ok"
                    ? "OK"
                    : result.distanceFlag === "attention"
                      ? "Atenção — distância do ponto"
                      : result.distanceFlag === "inconsistent"
                        ? "Inconsistente — muito distante do ponto"
                        : "Não avaliada"
                }
              />
            </dl>
            <button
              onClick={reset}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Ler próximo QR Code
            </button>
          </div>
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
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
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
