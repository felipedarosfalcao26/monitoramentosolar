// One-off importer: reads the "Plano de Manutenção" spreadsheet (DIÁRIA,
// SEMANAL, MENSAL, SEMESTRAL/TRIMESTRAL, ANUAL tabs) and creates the
// recurring MaintenanceTask templates for a plant. Safe to re-run — tasks
// are matched by (plantId, title, frequency) and updated in place rather
// than duplicated.
//
// Usage: npx tsx scripts/import-maintenance-plan.ts "<path-to-xlsx>" "<plant name>" "<plant code>"

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { parseMonthsFromText } from "../src/lib/maintenanceSchedule";

const prisma = new PrismaClient();

type Row = (string | number)[];

type ParsedTask = {
  title: string;
  description?: string;
  category?: string;
  frequency: "DIARIA" | "SEMANAL" | "MENSAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";
  scheduledMonths: number[];
  requiredTechnicians: number;
  assignedRole?: string;
};

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error(`Aba "${name}" não encontrada na planilha`);
  return XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: "" });
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v ? String(v) : "";
}

function num(v: unknown, fallback = 1): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** DIÁRIA rows repeat the same 6 activities every business day — dedupe by title. */
function parseDiaria(rows: Row[]): ParsedTask[] {
  const byTitle = new Map<string, ParsedTask>();
  for (const row of rows.slice(3)) {
    const title = str(row[3]);
    if (!title) continue;
    if (!byTitle.has(title)) {
      byTitle.set(title, {
        title,
        description: str(row[4]) || undefined,
        frequency: "DIARIA",
        scheduledMonths: [],
        requiredTechnicians: 1,
        assignedRole: str(row[5]) || undefined,
      });
    }
  }
  return [...byTitle.values()];
}

/** SEMANAL rows repeat the same weekly activities — dedupe by title. */
function parseSemanal(rows: Row[]): ParsedTask[] {
  const byTitle = new Map<string, ParsedTask>();
  for (const row of rows.slice(3)) {
    const title = str(row[4]);
    if (!title) continue;
    if (!byTitle.has(title)) {
      byTitle.set(title, {
        title,
        description: str(row[5]) || undefined,
        frequency: "SEMANAL",
        scheduledMonths: [],
        requiredTechnicians: num(row[7]),
        assignedRole: str(row[6]) || undefined,
      });
    }
  }
  return [...byTitle.values()];
}

/** MENSAL rows repeat the same ~16 activities every month — dedupe by title, skip "— Fim do mês —" separators. */
function parseMensal(rows: Row[]): ParsedTask[] {
  const byTitle = new Map<string, ParsedTask>();
  for (const row of rows.slice(3)) {
    const title = str(row[3]);
    if (!title || title.startsWith("—")) continue;
    if (!byTitle.has(title)) {
      byTitle.set(title, {
        title,
        description: str(row[4]) || undefined,
        category: str(row[5]) || undefined,
        frequency: "MENSAL",
        scheduledMonths: [],
        requiredTechnicians: num(row[7]),
        assignedRole: str(row[6]) || undefined,
      });
    }
  }
  return [...byTitle.values()];
}

/** SEMESTRAL tab mixes Semestral and Trimestral rows; the real frequency and months come from the FREQUÊNCIA/PERÍODO columns (or the title, when it disagrees — e.g. "(Trimestral)" in the title). */
function parseSemestralTrimestral(rows: Row[]): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  for (const row of rows.slice(3)) {
    const title = str(row[3]);
    if (!title) continue;
    const freqText = str(row[1]).toLowerCase();
    const periodText = str(row[2]);
    const isTrimestral = title.toLowerCase().includes("trimestral") || freqText.includes("trimestral");
    const months = parseMonthsFromText(periodText);
    tasks.push({
      title,
      description: str(row[4]) || undefined,
      frequency: isTrimestral ? "TRIMESTRAL" : "SEMESTRAL",
      scheduledMonths: months.length > 0 ? months : isTrimestral ? [3, 6, 9, 12] : [],
      requiredTechnicians: num(row[6]),
      assignedRole: str(row[5]) || undefined,
    });
  }
  return tasks;
}

function parseAnual(rows: Row[]): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  for (const row of rows.slice(3)) {
    const title = str(row[3]);
    if (!title) continue;
    const months = parseMonthsFromText(str(row[2]));
    tasks.push({
      title,
      description: str(row[4]) || undefined,
      frequency: "ANUAL",
      scheduledMonths: months,
      requiredTechnicians: num(row[6]),
      assignedRole: str(row[5]) || undefined,
    });
  }
  return tasks;
}

async function main() {
  const filePath = process.argv[2];
  const plantName = process.argv[3] ?? "UFV Iramaia II";
  const plantCode = process.argv[4] ?? "IRAMAIA-II";
  if (!filePath) {
    console.error('Uso: npx tsx scripts/import-maintenance-plan.ts "<caminho.xlsx>" ["Nome da Usina"] ["CODIGO"]');
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath, { cellDates: true });
  const parsed: ParsedTask[] = [
    ...parseDiaria(sheetRows(wb, "☀️ DIÁRIA")),
    ...parseSemanal(sheetRows(wb, "📅 SEMANAL")),
    ...parseMensal(sheetRows(wb, "🗓️ MENSAL")),
    ...parseSemestralTrimestral(sheetRows(wb, "📆 SEMESTRAL")),
    ...parseAnual(sheetRows(wb, "📁 ANUAL")),
  ];

  console.log(`Lidas ${parsed.length} atividades distintas da planilha.`);

  // Match by code first, but fall back to an existing plant with the same
  // name — the code passed on the command line is just a guess and must
  // never cause a same-plant duplicate (it happened once already).
  let plant = await prisma.plant.findUnique({ where: { code: plantCode } });
  if (!plant) plant = await prisma.plant.findFirst({ where: { name: plantName } });
  if (!plant) {
    console.log(`Usina "${plantName}" não encontrada — criando com coordenadas provisórias.`);
    plant = await prisma.plant.create({
      data: {
        name: plantName,
        code: plantCode,
        ownerCompany: "Apolo Energia",
        state: "BA",
        city: "Iramaia",
        // Provisional coordinates — edit in Admin > Usinas once the real ones are known.
        latitude: -13.376,
        longitude: -40.911,
        status: "ATIVA",
      },
    });
  }

  let created = 0;
  let updated = 0;
  for (const t of parsed) {
    const existing = await prisma.maintenanceTask.findFirst({
      where: { plantId: plant.id, title: t.title, frequency: t.frequency },
    });
    if (existing) {
      await prisma.maintenanceTask.update({
        where: { id: existing.id },
        data: {
          description: t.description,
          category: t.category,
          scheduledMonths: t.scheduledMonths,
          requiredTechnicians: t.requiredTechnicians,
          assignedRole: t.assignedRole,
        },
      });
      updated++;
    } else {
      await prisma.maintenanceTask.create({
        data: {
          plantId: plant.id,
          title: t.title,
          description: t.description,
          category: t.category,
          frequency: t.frequency,
          scheduledMonths: t.scheduledMonths,
          requiredTechnicians: t.requiredTechnicians,
          assignedRole: t.assignedRole,
        },
      });
      created++;
    }
  }

  console.log(`Importação concluída para "${plant.name}": ${created} atividades criadas, ${updated} atualizadas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
