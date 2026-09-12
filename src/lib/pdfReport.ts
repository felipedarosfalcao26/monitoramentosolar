import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { worldX, worldY } from "./webMercator";

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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
  photoUrls: string[];
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

/** Draws the real OpenStreetMap background (fetched server-side) with equipment vs. reading markers on top. */
async function drawPositionDiagram(doc: jsPDF, y: number, equipment: ReportEquipment[], scans: ReportScan[]): Promise<number> {
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
  const boxMinLat = minLat - latSpan * 0.6;
  const boxMaxLat = maxLat + latSpan * 0.6;
  const boxMinLng = minLng - lngSpan * 0.6;
  const boxMaxLng = maxLng + lngSpan * 0.6;

  const pxWidth = 1000;
  const pxHeight = Math.round((pxWidth * mapHeight) / mapW);
  const mapUrl = `/api/staticmap?minLat=${boxMinLat}&maxLat=${boxMaxLat}&minLng=${boxMinLng}&maxLng=${boxMaxLng}&width=${pxWidth}&height=${pxHeight}`;
  const basemap = await fetchAsDataUrl(mapUrl);

  if (basemap) {
    doc.addImage(basemap, "PNG", mapLeft, mapTop, mapW, mapHeight);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Não foi possível carregar o mapa de fundo.", mapLeft + mapW / 2, mapTop + mapHeight / 2, { align: "center" });
  }

  // Project using the same Web Mercator fractions the /api/staticmap image was cropped to,
  // so markers land exactly where they belong on the real map underneath them.
  const worldXMin = worldX(boxMinLng);
  const worldXMax = worldX(boxMaxLng);
  const worldYMin = worldY(boxMaxLat); // north edge
  const worldYMax = worldY(boxMinLat); // south edge

  function project(lat: number, lng: number): [number, number] {
    const xFrac = (worldX(lng) - worldXMin) / (worldXMax - worldXMin);
    const yFrac = (worldY(lat) - worldYMin) / (worldYMax - worldYMin);
    return [mapLeft + xFrac * mapW, mapTop + yFrac * mapHeight];
  }

  const insideScans = scans.filter(
    (s) => s.latitude >= boxMinLat && s.latitude <= boxMaxLat && s.longitude >= boxMinLng && s.longitude <= boxMaxLng
  );
  const outsideCount = scans.length - insideScans.length;

  // Readings first (so equipment markers stay on top and legible).
  doc.setFillColor(220, 38, 38);
  doc.setDrawColor(255, 255, 255);
  insideScans.forEach((s) => {
    const [px, py] = project(s.latitude, s.longitude);
    doc.circle(px, py, 1.6, "FD");
  });

  doc.setFillColor(37, 99, 235);
  equipment.forEach((eq) => {
    const [px, py] = project(eq.latitude, eq.longitude);
    doc.circle(px, py, 2.2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(eq.code, px + 2.8, py + 1);
    doc.setTextColor(15, 23, 42);
    doc.text(eq.code, px + 2.7, py + 0.9);
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
      `${outsideCount} leitura(s) registrada(s) muito distante(s) da área da usina não aparecem neste mapa — ver tabela de leituras.`,
      MARGIN,
      afterY
    );
    afterY += 5;
  }

  return afterY + 4;
}

export async function generateInspectionReportPdf(input: ReportInput) {
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
  y = await drawPositionDiagram(doc, y, input.equipment, input.scans);

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
        s.photoUrls?.length ? `${s.photoUrls.length}` : "—",
      ]),
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Nenhuma leitura encontrada para os filtros selecionados.", MARGIN, y);
  }

  const photoEntries = input.scans.flatMap((s) =>
    (s.photoUrls?.length ? s.photoUrls : s.photoUrl ? [s.photoUrl] : []).map((url) => ({ scan: s, url }))
  );
  if (photoEntries.length > 0) {
    doc.addPage();
    let py = drawSectionTitle(doc, `Fotos das Leituras (${photoEntries.length})`, 20);

    const cols = 3;
    const gap = 6;
    const cellW = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
    const cellImgH = cellW * 0.75;
    const cellH = cellImgH + 12;
    let col = 0;

    for (const { scan: s, url } of photoEntries) {
      if (py + cellH > 280) {
        doc.addPage();
        py = 20;
        col = 0;
      }
      const x = MARGIN + col * (cellW + gap);
      const dataUrl = await fetchAsDataUrl(url);
      doc.setDrawColor(226, 232, 240);
      doc.rect(x, py, cellW, cellImgH);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, x, py, cellW, cellImgH, undefined, "FAST");
        } catch {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text("Não foi possível carregar a foto", x + cellW / 2, py + cellImgH / 2, { align: "center" });
        }
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Foto indisponível", x + cellW / 2, py + cellImgH / 2, { align: "center" });
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(`${s.equipmentName} (${s.equipmentCode})`, x, py + cellImgH + 4);
      doc.setTextColor(148, 163, 184);
      doc.text(formatDateTime(s.scannedAt), x, py + cellImgH + 8);

      col++;
      if (col >= cols) {
        col = 0;
        py += cellH + gap;
      }
    }
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
