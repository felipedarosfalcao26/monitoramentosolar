export const MAINTENANCE_FREQUENCIES = ["DIARIA", "SEMANAL", "MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const;
export type MaintenanceFrequency = (typeof MAINTENANCE_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<MaintenanceFrequency, string> = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

export const MAINTENANCE_STATUSES = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "ATRASADA", "CANCELADA"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  ATRASADA: "Atrasada",
  CANCELADA: "Cancelada",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** ISO week number (1-53) and the Monday..Friday range it covers. */
function isoWeekInfo(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { year: date.getUTCFullYear(), week, monday: startOfDay(monday), friday: endOfDay(friday) };
}

function quarterOfMonth(month1to12: number) {
  return Math.ceil(month1to12 / 3);
}

export type Period = { key: string; dueDate: Date; windowStart: Date; windowEnd: Date };

/** Is `date` a business day (Mon-Fri)? Daily activities only run on business days. */
export function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * The current recurrence period that contains `date` for a given frequency —
 * its unique key (for MaintenanceExecution.periodKey), the window it spans,
 * and the deadline (dueDate) by which it should be completed.
 */
export function getPeriod(frequency: MaintenanceFrequency, date: Date): Period {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;

  switch (frequency) {
    case "DIARIA": {
      const day = startOfDay(date);
      return { key: dateKey(day), dueDate: endOfDay(day), windowStart: day, windowEnd: endOfDay(day) };
    }
    case "SEMANAL": {
      const { year, week, monday, friday } = isoWeekInfo(date);
      return { key: `${year}-W${pad(week)}`, dueDate: friday, windowStart: monday, windowEnd: friday };
    }
    case "MENSAL": {
      const start = new Date(y, date.getMonth(), 1);
      const end = endOfDay(new Date(y, date.getMonth() + 1, 0));
      return { key: `${y}-${pad(m)}`, dueDate: end, windowStart: start, windowEnd: end };
    }
    case "TRIMESTRAL": {
      const q = quarterOfMonth(m);
      const startMonth = (q - 1) * 3;
      const start = new Date(y, startMonth, 1);
      const end = endOfDay(new Date(y, startMonth + 3, 0));
      return { key: `${y}-Q${q}`, dueDate: end, windowStart: start, windowEnd: end };
    }
    case "SEMESTRAL": {
      const s = m <= 6 ? 1 : 2;
      const startMonth = s === 1 ? 0 : 6;
      const start = new Date(y, startMonth, 1);
      const end = endOfDay(new Date(y, startMonth + 6, 0));
      return { key: `${y}-S${s}`, dueDate: end, windowStart: start, windowEnd: end };
    }
    case "ANUAL": {
      const start = new Date(y, 0, 1);
      const end = endOfDay(new Date(y, 11, 31));
      return { key: `${y}`, dueDate: end, windowStart: start, windowEnd: end };
    }
  }
}

/**
 * Whether a task's current-period execution should exist/keep showing as of
 * `date`. For TRIMESTRAL/SEMESTRAL/ANUAL this depends on scheduledMonths: the
 * task "starts counting" once the calendar reaches its earliest scheduled
 * trigger month within `period`, and — critically — stays due for the rest
 * of that period (not just the trigger month) so an unfinished instance
 * shows as ATRASADA after its deadline instead of silently disappearing once
 * the trigger month ends. An empty scheduledMonths means "every period".
 */
export function isTaskDueInPeriod(
  frequency: MaintenanceFrequency,
  scheduledMonths: number[],
  period: Period,
  date: Date
): boolean {
  if (frequency === "DIARIA") return isBusinessDay(date);
  if (frequency === "SEMANAL" || frequency === "MENSAL") return true;
  if (scheduledMonths.length === 0) return true;

  const periodStartMonth = period.windowStart.getMonth() + 1;
  const periodEndMonth = period.windowEnd.getMonth() + 1;
  const relevant = scheduledMonths.filter((m) => m >= periodStartMonth && m <= periodEndMonth);
  if (relevant.length === 0) return false;

  const earliestTrigger = Math.min(...relevant);
  return date.getMonth() + 1 >= earliestTrigger;
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

/** Parses free-form PT-BR month text ("Out", "Set/Out", "S1-Jan / S2-Jun", "Mar/Jun/Set/Dez") into month numbers. */
export function parseMonthsFromText(text: string): number[] {
  const months = new Set<number>();
  const normalized = text.toLowerCase();
  for (const [name, num] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    if (normalized.includes(name)) months.add(num);
  }
  return [...months].sort((a, b) => a - b);
}

/** Effective status: an unfinished execution past its dueDate reads as ATRASADA regardless of the stored value. */
export function effectiveStatus(status: string, dueDate: Date, now: Date = new Date()): MaintenanceStatus {
  if (status === "CONCLUIDA" || status === "CANCELADA") return status;
  if (now.getTime() > dueDate.getTime()) return "ATRASADA";
  return status === "EM_ANDAMENTO" ? "EM_ANDAMENTO" : "PENDENTE";
}
