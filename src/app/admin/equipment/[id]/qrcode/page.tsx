"use client";

import { useEffect, useState, use } from "react";
import { generateQrLabelPdf } from "@/lib/qrLabelPdf";

type EquipmentDetail = {
  id: string;
  code: string;
  name: string;
  type: string;
  plant: { name: string };
  qrCode: { token: string; status: string } | null;
};

export default function EquipmentQrCodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [equipment, setEquipment] = useState<EquipmentDetail | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  function load() {
    fetch(`/api/equipment/${id}`)
      .then((r) => r.json())
      .then((d) => setEquipment(d.equipment));
  }

  useEffect(load, [id]);

  async function regenerate() {
    if (!confirm("O QR Code atual será invalidado e um novo será gerado. Continuar?")) return;
    setRegenerating(true);
    try {
      await fetch(`/api/equipment/${id}/qrcode`, { method: "POST" });
      load();
    } finally {
      setRegenerating(false);
    }
  }

  if (!equipment) return <p className="text-sm text-slate-500">Carregando...</p>;

  const token = equipment.qrCode?.token;

  async function downloadPdf() {
    if (!token || !equipment) return;
    setGeneratingPdf(true);
    try {
      await generateQrLabelPdf({ code: equipment.code, name: equipment.name, plantName: equipment.plant.name, token });
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{equipment.name}</h1>
        <p className="text-sm text-slate-500">
          {equipment.code} · {equipment.type} · {equipment.plant.name}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm print:border-none print:shadow-none">
        {token ? (
          <>
            <img
              src={`/api/qrcodes/${token}/image?format=png`}
              alt={`QR Code de ${equipment.name}`}
              className="mx-auto h-64 w-64"
            />
            <p className="mt-4 text-lg font-semibold">{equipment.name}</p>
            <p className="text-sm text-slate-500">
              {equipment.code} — {equipment.plant.name}
            </p>
          </>
        ) : (
          <p className="text-sm text-red-600">Este equipamento não possui um QR Code ativo.</p>
        )}
      </div>

      {token && (
        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            onClick={downloadPdf}
            disabled={generatingPdf}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {generatingPdf ? "Gerando..." : "Baixar PDF para impressão"}
          </button>
          <a
            href={`/api/qrcodes/${token}/image?format=png`}
            download={`qrcode-${equipment.code}.png`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Baixar PNG
          </a>
          <a
            href={`/api/qrcodes/${token}/image?format=svg`}
            download={`qrcode-${equipment.code}.svg`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Baixar SVG
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Imprimir
          </button>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {regenerating ? "Gerando..." : "Regenerar QR Code"}
          </button>
        </div>
      )}
    </div>
  );
}
