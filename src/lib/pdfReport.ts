import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const FLAG_LABEL: Record<string, string> = { ok: "OK", attention: "Atenção", inconsistent: "Inconsistente" };
const CATEGORY_LABEL: Record<string, string> = {
  PORTAO_ABERTO: "Portão aberto",
  CERCA_DANIFICADA: "Cerca danificada",
  ILUMINACAO_APAGADA: "Iluminação apagada",
  EQUIPAMENTO_DANIFICADO: "Equipamento danificado",
  PRESENCA_TERCEIROS: "Presença de terceiros",
  VEGETACAO: "Vegetação",
  ALAGAMENTO: "Alagamento",
  FURTO_TENTATIVA: "Furto/tentativa de furto",
  ANOMALIA_OPERACIONAL: "Anomalia operacional",
  OUTRO: "Outro",
};

export type ReportEquipment = { id: string; code: string; name: string; latitude: number; longitude: number };
export type ReportScan = {
  id: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  distanceFlag: string | null;
  userName: string;
  equipmentName: string;
  equipmentCode: string;
  notes: string | null;
  photoUrl: string | null;
};
export type ReportRound = {
  startedAt: string;
  endedAt: string | null;
  userName: string;
  routeName: string | null;
  plannedPoints: number;
  visitedPoints: number;
  completionPercent: number | null;
  distanceMeters: number | null;
  status: string;
};
export type ReportOccurrence = {
  createdAt: string;
  equipmentName: string | null;
  category: string;
  severity: string;
  status: string;
  description: string | null;
};

export type ReportInput = {
  plantName: string;
  generatedAt: Date;
  filters: { from?: string; to?: string; userName?: string; equipmentName?: string };
  equipment: ReportEquipment[];
  scans: ReportScan[];
  rounds: ReportRound[];
  occurrences: ReportOccurrence[];
};

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, y + 1.5, PAGE_WIDTH - MARGIN, y + 1.5);
  return y + 8;
}

function getFinalY(doc: jsPDF, fallback: number): number {
  const d = doc as unknown as { lastAutoTable?: { finalY: number } };
  return d.lastAutoTable?.finalY ?? fallback;
}

/** Draws a schematic (non-georeferenced) scatter of equipment vs. reading points. */
function drawPositionDiagram(doc: jsPDF, y: number, equipment: ReportEquipment[], scans: ReportScan[]): number {
  const mapHeight = 95;
  const mapTop = y;
  const mapLeft = MARGIN;
  const mapW = CONTENT_WIDTH;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(mapLeft, mapTop, mapW, mapHeight, "FD");

  if (equipment.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Nenhum equipamento cadastrado nesta usina.", mapLeft + mapW / 2, mapTop + mapHeight / 2, { align: "center" });
    return mapTop + mapHeight + 10;
  }

  const eqLats = equipment.map((e) => e.latitude);
  const eqLngs = equipment.map((e) => e.longitude);
  const minLat = Math.min(...eqLats);
  const maxLat = Math.max(...eqLats);
  const minLng = Math.min(...eqLngs);
  const maxLng = Math.max(...eqLngs);
  const latSpan = Math.max(maxLat - minLat, 0.0008);
  const lngSpan = Math.max(maxLng - minLng, 0.0008);

  // Pad the plotted area generously so nearby readings still land inside it.
  const padLat = latSpan * 0.6;
  const padLng = lngSpan * 0.6;
  const boxMinLat = minLat - padLat;
  const boxMaxLat = maxLat + padLat;
  const boxMinLng = minLng - padLng;
  const boxMaxLng = maxLng + padLng;
  const boxLatSpan = boxMaxLat - boxMinLat;
  const boxLngSpan = boxMaxLng - boxMinLng;

  const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const aspectCorrection = Math.cos(avgLatRad) || 1;
  const innerPad = 12;
  const drawW = mapW - innerPad * 2;
  const drawH = mapHeight - innerPad * 2;
  const scale = Math.min(drawW / (boxLngSpan * aspectCorrection), drawH / boxLatSpan);

  function project(lat: number, lng: number) {
    const x = mapLeft + innerPad + (lng - boxMinLng) * aspectCorrection * scale + (drawW - boxLngSpan * aspectCorrection * scale) / 2;
    const y2 = mapTop + innerPad + (boxMaxLat - lat) * scale + (drawH - boxLatSpan * scale) / 2;
    return [x, y2] as const;
  }

  const insideScans = scans.filter(
    (s) => s.latitude >= boxMinLat && s.latitude <= boxMaxLat && s.longitude >= boxMinLng && s.longitude <= boxMaxLng
  );
  const outsideCount = scans.length - insideScans.length;

  // Readings first (so equipment markers stay on top and legible).
  doc.setFillColor(220, 38, 38);
  insideScans.forEach((s) => {
    const [px, py] = project(s.latitude, s.longitude);
    doc.circle(px, py, 1.4, "F");
  });

  doc.setFillColor(37, 99, 235);
  doc.setDrawColor(255, 255, 255);
  equipment.forEach((eq) => {
    const [px, py] = project(eq.latitude, eq.longitude);
    doc.circle(px, py, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(eq.code, px + 2.5, py + 1);
  });

  // Legend
  const legendY = mapTop + mapHeight + 6;
  doc.setFillColor(37, 99, 235);
  doc.circle(MARGIN + 2, legendY - 1.2, 1.6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text("Equipamento cadastrado", MARGIN + 6, legendY);

  doc.setFillColor(220, 38, 38);
  doc.circle(MARGIN + 62, legendY - 1.2, 1.6, "F");
  doc.text("Ponto de leitura registrado", MARGIN + 66, legendY);

  let afterY = legendY + 6;
  if (outsideCount > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${outsideCount} leitura(s) registrada(s) muito distante(s) da área da usina não aparecem neste diagrama — ver tabela de leituras.`,
      MARGIN,
      afterY
    );
    afterY += 5;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Diagrama esquemático de posições relativas — não é um mapa georreferenciado em escala.", MARGIN, afterY);

  return afterY + 8;
}

export function generateInspectionReportPdf(input: ReportInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("Relatório de Vistorias", MARGIN, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(input.plantName, MARGIN, 27);

  const filterParts: string[] = [];
  if (input.filters.from || input.filters.to) {
    filterParts.push(`Período: ${input.filters.from ?? "início"} até ${input.filters.to ?? "hoje"}`);
  }
  if (input.filters.userName) filterParts.push(`Vigilante: ${input.filters.userName}`);
  if (input.filters.equipmentName) filterParts.push(`Equipamento: ${input.filters.equipmentName}`);
  doc.setFontSize(9);
  doc.text(filterParts.length ? filterParts.join("  ·  ") : "Sem filtros adicionais", MARGIN, 33);
  doc.text(`Gerado em ${input.generatedAt.toLocaleString("pt-BR")}`, PAGE_WIDTH - MARGIN, 20, { align: "right" });

  let y = 44;

  y = drawSectionTitle(doc, `Rondas Realizadas (${input.rounds.length})`, y);
  if (input.rounds.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 23, 42] },
      head: [["Início", "Fim", "Vigilante", "Rota", "Pontos", "Conclusão", "Duração", "Distância", "Status"]],
      body: input.rounds.map((r) => {
        const durationMin = Math.round(
          ((r.endedAt ? new Date(r.endedAt).getTime() : Date.now()) - new Date(r.startedAt).getTime()) / 60000
        );
        return [
          formatDateTime(r.startedAt),
          r.endedAt ? formatDateTime(r.endedAt) : "—",
          r.userName,
          r.routeName ?? "Livre",
          r.plannedPoints > 0 ? `${r.visitedPoints}/${r.plannedPoints}` : `${r.visitedPoints}`,
          r.completionPercent !== null ? `${r.completionPercent}%` : "—",
          `${durationMin} min`,
          r.distanceMeters !== null ? `${(r.distanceMeters / 1000).toFixed(2)} km` : "—",
          r.status === "COMPLETED" ? "Concluída" : "Em andamento",
        ];
      }),
    });
    y = getFinalY(doc, y) + 10;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhuma ronda encontrada para os filtros selecionados.", MARGIN, y);
    y += 10;
  }

  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  y = drawSectionTitle(doc, `Ocorrências (${input.occurrences.length})`, y);
  if (input.occurrences.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 23, 42] },
      head: [["Data/Hora", "Equipamento", "Categoria", "Severidade", "Status", "Descrição"]],
      body: input.occurrences.map((o) => [
        formatDateTime(o.createdAt),
        o.equipmentName ?? "—",
        CATEGORY_LABEL[o.category] ?? o.category,
        o.severity,
        o.status,
        o.description ?? "—",
      ]),
    });
    y = getFinalY(doc, y) + 10;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhuma ocorrência encontrada para os filtros selecionados.", MARGIN, y);
    y += 10;
  }

  doc.addPage();
  y = 20;
  y = drawSectionTitle(doc, "Mapa de Pontos", y);
  y = drawPositionDiagram(doc, y, input.equipment, input.scans);

  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  y = drawSectionTitle(doc, `Leituras Registradas (${input.scans.length})`, y);
  if (input.scans.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 7, cellPadding: 1.3 },
      headStyles: { fillColor: [15, 23, 42] },
      head: [["Data/Hora", "Vigilante", "Equipamento", "Status", "Observação", "Foto"]],
      body: input.scans.map((s) => [
        formatDateTime(s.scannedAt),
        s.userName,
        `${s.equipmentName} (${s.equipmentCode})`,
        FLAG_LABEL[s.distanceFlag ?? "ok"],
        s.notes ?? "—",
        s.photoUrl ? "Sim" : "—",
      ]),
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhuma leitura encontrada para os filtros selecionados.", MARGIN, y);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Vistoria Solar — página ${i} de ${pageCount}`, PAGE_WIDTH / 2, 292, { align: "center" });
  }

  const filenameDate = input.generatedAt.toISOString().slice(0, 10);
  doc.save(`relatorio-vistorias-${filenameDate}.pdf`);
}
