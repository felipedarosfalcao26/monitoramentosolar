import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ExecutiveReportInput = {
  generatedAt: Date;
  rangeDays: number;
  overall: {
    totalPlants: number;
    totalEquipment: number;
    activeTechnicians: number;
    activeVigilantes: number;
    scansLast30: number;
    inconsistentRate: number;
    roundsAvgCompletion: number | null;
    occurrencesOpenTotal: number;
  };
  occurrencesBySeverity: Record<string, number>;
  byPlant: {
    plantName: string;
    scansLast30: number;
    roundsAvgCompletion: number | null;
    occurrencesOpen: number;
    maintenanceCompleted30: number;
  }[];
};

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, y + 1.5, PAGE_WIDTH - MARGIN, y + 1.5);
  return y + 8;
}

function drawKpiTile(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(value, x + 4, y + h / 2 - 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + 4, y + h - 4, { maxWidth: w - 8 });
}

export async function generateExecutiveReportPdf(input: ExecutiveReportInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text("Relatório Executivo", MARGIN, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Vistoria Solar — visão consolidada de todas as usinas", MARGIN, 27);
  doc.setFontSize(9);
  doc.text(`Gerado em ${input.generatedAt.toLocaleString("pt-BR")} · janela de tendência: ${input.rangeDays} dias`, MARGIN, 33);

  let y = 44;
  y = drawSectionTitle(doc, "Indicadores Gerais", y);

  const tiles: [string, string][] = [
    ["Usinas monitoradas", String(input.overall.totalPlants)],
    ["Equipamentos cadastrados", String(input.overall.totalEquipment)],
    ["Técnicos ativos", String(input.overall.activeTechnicians)],
    ["Vigilantes ativos", String(input.overall.activeVigilantes)],
    ["Leituras (30 dias)", String(input.overall.scansLast30)],
    ["Taxa de inconsistência", `${input.overall.inconsistentRate}%`],
    ["Conclusão média de rondas", input.overall.roundsAvgCompletion !== null ? `${input.overall.roundsAvgCompletion}%` : "—"],
    ["Ocorrências em aberto", String(input.overall.occurrencesOpenTotal)],
  ];
  const cols = 4;
  const gap = 4;
  const tileW = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
  const tileH = 20;
  tiles.forEach(([label, value], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawKpiTile(doc, MARGIN + col * (tileW + gap), y + row * (tileH + gap), tileW, tileH, label, value);
  });
  y += Math.ceil(tiles.length / cols) * (tileH + gap) + 6;

  y = drawSectionTitle(doc, "Ocorrências em Aberto por Severidade", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    head: [["Baixa", "Média", "Alta", "Crítica"]],
    body: [
      [
        String(input.occurrencesBySeverity.BAIXA ?? 0),
        String(input.occurrencesBySeverity.MEDIA ?? 0),
        String(input.occurrencesBySeverity.ALTA ?? 0),
        String(input.occurrencesBySeverity.CRITICA ?? 0),
      ],
    ],
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  y = drawSectionTitle(doc, "Comparativo por Usina", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    head: [["Usina", "Leituras (30d)", "Conclusão média de rondas", "Manutenções concluídas (30d)", "Ocorrências abertas"]],
    body: input.byPlant.map((p) => [
      p.plantName,
      String(p.scansLast30),
      p.roundsAvgCompletion !== null ? `${p.roundsAvgCompletion}%` : "—",
      String(p.maintenanceCompleted30),
      String(p.occurrencesOpen),
    ]),
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Vistoria Solar — relatório executivo — página ${i} de ${pageCount}`, PAGE_WIDTH / 2, 292, { align: "center" });
  }

  doc.save(`relatorio-executivo-${input.generatedAt.toISOString().slice(0, 10)}.pdf`);
}
