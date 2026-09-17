import { jsPDF } from "jspdf";

export type QrLabelEquipment = {
  code: string;
  name: string;
  plantName: string;
  token: string;
};

async function fetchQrDataUrl(token: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/qrcodes/${token}/image?format=png`);
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

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

/** Draws one bordered, cut-out-able QR label (equipment name + code + QR) inside the given box. */
function drawLabel(doc: jsPDF, x: number, y: number, w: number, h: number, eq: QrLabelEquipment, qrDataUrl: string | null) {
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1.2], 0);
  doc.roundedRect(x, y, w, h, 2, 2, "S");
  doc.setLineDashPattern([], 0);

  const padding = 4;
  const innerW = w - padding * 2;
  const qrSize = Math.min(innerW, h - 26);
  const qrX = x + (w - qrSize) / 2;
  const qrY = y + padding + 2;

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  } else {
    doc.setDrawColor(226, 232, 240);
    doc.rect(qrX, qrY, qrSize, qrSize);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("QR indisponível", x + w / 2, qrY + qrSize / 2, { align: "center" });
  }

  let textY = qrY + qrSize + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(eq.name, x + w / 2, textY, { align: "center", maxWidth: innerW });

  textY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(eq.code, x + w / 2, textY, { align: "center" });

  textY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(eq.plantName, x + w / 2, textY, { align: "center", maxWidth: innerW });
}

/** A single, generously-sized label centered on an A4 page — ready to print and cut out. */
export async function generateQrLabelPdf(eq: QrLabelEquipment) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const qrDataUrl = await fetchQrDataUrl(eq.token);

  const labelW = 100;
  const labelH = 130;
  const x = (PAGE_WIDTH - labelW) / 2;
  const y = (PAGE_HEIGHT - labelH) / 2;

  drawLabel(doc, x, y, labelW, labelH, eq, qrDataUrl);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Vistoria Solar", PAGE_WIDTH / 2, PAGE_HEIGHT - 12, { align: "center" });

  doc.save(`qrcode-${eq.code}.pdf`);
}

/** A grid of labels (6 per A4 page) for printing QR codes of several pieces of equipment at once. */
export async function generateQrLabelSheetPdf(list: QrLabelEquipment[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const cols = 2;
  const rows = 3;
  const margin = 10;
  const gap = 6;
  const cellW = (PAGE_WIDTH - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = (PAGE_HEIGHT - margin * 2 - gap * (rows - 1)) / rows;
  const perPage = cols * rows;

  const dataUrls = await Promise.all(list.map((eq) => fetchQrDataUrl(eq.token)));

  list.forEach((eq, i) => {
    const posInPage = i % perPage;
    if (i > 0 && posInPage === 0) doc.addPage();
    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = margin + col * (cellW + gap);
    const y = margin + row * (cellH + gap);
    drawLabel(doc, x, y, cellW, cellH, eq, dataUrls[i]);
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Vistoria Solar — QR Codes de equipamentos — página ${i} de ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 6, { align: "center" });
  }

  doc.save(`qrcodes-equipamentos-${new Date().toISOString().slice(0, 10)}.pdf`);
}
