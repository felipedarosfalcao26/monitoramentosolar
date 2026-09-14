"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FREQUENCY_LABELS,
  STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  type MaintenanceFrequency,
  type MaintenanceStatus,
  type ReviewStatus,
} from "@/lib/maintenanceSchedule";

type Plant = { id: string; name: string };
type Equipment = { id: string; name: string; code: string; plantId: string };
type TechUser = { id: string; name: string; phone: string | null };

type Task = {
  id: string;
  plantId: string;
  equipmentId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  frequency: MaintenanceFrequency;
  scheduledMonths: number[];
  requiredTechnicians: number;
  assignedRole: string | null;
  assignedUserId: string | null;
  active: boolean;
  plant: { id: string; name: string };
  equipment: { id: string; name: string; code: string } | null;
  assignedUser: { id: string; name: string; phone: string | null } | null;
};

type Execution = {
  id: string;
  status: MaintenanceStatus;
  dueDate: string;
  completedAt: string | null;
  notes: string | null;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  reviewStatus: ReviewStatus | null;
  reviewNotes: string | null;
  user: { id: string; name: string } | null;
  reviewer: { id: string; name: string } | null;
  task: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    frequency: MaintenanceFrequency;
    assignedUserId: string | null;
    plant: { id: string; name: string };
    equipment: { id: string; name: string; code: string } | null;
  };
};

type Stats = {
  total: number;
  overall: Record<MaintenanceStatus, number>;
  unassigned: number;
  byPlant: ({ plantId: string; plantName: string } & Record<MaintenanceStatus, number>)[];
  byTechnician: ({ userId: string; userName: string } & Record<MaintenanceStatus, number>)[];
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CATEGORY_SUGGESTIONS = [
  "Civil",
  "Elétrico",
  "Civil/Elétrico",
  "Mecânico",
  "Mecânico/Elétrico",
  "FV",
  "FV/Elétrico",
  "Instrumentação",
  "Automação",
  "Segurança",
  "Gestão",
];
const ROLE_SUGGESTIONS = [
  "Operador",
  "Técnico de Campo",
  "Técnico Eletricista",
  "Técnico Mecânico",
  "Técnico Instrumentação",
  "Engenheiro",
  "Engenheiro Civil",
  "Engenheiro Eletricista",
  "Engenheiro Mecânico",
  "Engenheiro Automação",
  "Especialista Drone",
];

const STATUS_COLOR: Record<MaintenanceStatus, string> = {
  PENDENTE: "bg-slate-100 text-slate-600",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700",
  CONCLUIDA: "bg-emerald-100 text-emerald-700",
  ATRASADA: "bg-red-100 text-red-700",
  CANCELADA: "bg-slate-200 text-slate-500",
};

const REVIEW_COLOR: Record<ReviewStatus, string> = {
  APROVADO: "bg-emerald-100 text-emerald-700",
  REPROVADO: "bg-red-100 text-red-700",
  CORRIGIR: "bg-amber-100 text-amber-700",
};

const emptyForm = {
  plantId: "",
  equipmentId: "",
  title: "",
  description: "",
  category: "",
  frequency: "MENSAL" as MaintenanceFrequency,
  scheduledMonths: [] as number[],
  requiredTechnicians: 1,
  assignedRole: "",
  assignedUserId: "",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { from: start.toISOString(), to: end.toISOString() };
}

function buildWhatsAppLink(phone: string, technicianName: string, plantName: string, tasks: Execution[]) {
  const dateLabel = new Date().toLocaleDateString("pt-BR");
  const lines = [
    `Olá ${technicianName}! Resumo das atividades de manutenção de hoje (${dateLabel}) — ${plantName}:`,
    "",
    ...tasks.map(
      (ex, i) => `${i + 1}. ${ex.task.title} (${FREQUENCY_LABELS[ex.task.frequency]})${ex.status === "ATRASADA" ? " ⚠️ ATRASADA" : ""}`
    ),
    "",
    "Por favor registre a execução no app (com leitura do QR Code do equipamento, quando aplicável). Qualquer dúvida, chame o gestor.",
  ];
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export default function MaintenancePage() {
  const [tab, setTab] = useState<"execucoes" | "cronograma">("execucoes");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [technicians, setTechnicians] = useState<TechUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  // Execuções tab
  const [execFilters, setExecFilters] = useState({ plantId: "", date: todayStr(), userId: "", status: "", frequency: "" });
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [reviewNotesDraft, setReviewNotesDraft] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  // Cronograma tab
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterPlant, setFilterPlant] = useState("");
  const [filterFrequency, setFilterFrequency] = useState("");
  const [search, setSearch] = useState("");

  // Calendar
  const [calendarPlantId, setCalendarPlantId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarExecutions, setCalendarExecutions] = useState<Execution[]>([]);

  function loadTasks() {
    fetch("/api/maintenance/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []));
  }

  function loadStats() {
    fetch("/api/maintenance/stats")
      .then((r) => r.json())
      .then(setStats);
  }

  async function loadExecutions() {
    setLoadingExecutions(true);
    try {
      const { date, plantId, userId, status, frequency } = execFilters;
      const isToday = date === todayStr();
      if (isToday) {
        // Ensure today's periods are materialized before reading the plain list.
        const params = new URLSearchParams();
        if (plantId) params.set("plantId", plantId);
        await fetch(`/api/maintenance/today?${params.toString()}`);
      }
      const { from, to } = dayRange(date);
      const params = new URLSearchParams({ from, to });
      if (plantId) params.set("plantId", plantId);
      if (userId) params.set("userId", userId);
      if (status) params.set("status", status);
      if (frequency) params.set("frequency", frequency);
      const res = await fetch(`/api/maintenance/executions?${params.toString()}`);
      const data = await res.json();
      setExecutions(data.executions ?? []);
    } finally {
      setLoadingExecutions(false);
    }
  }

  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.plants ?? []));
    fetch("/api/equipment")
      .then((r) => r.json())
      .then((d) => setEquipment(d.equipment ?? []));
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setTechnicians((d.users ?? []).filter((u: { role: string }) => u.role === "TECNICO_MANUTENCAO")));
    loadTasks();
    loadStats();
  }, []);

  useEffect(() => {
    loadExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execFilters]);

  useEffect(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    const params = new URLSearchParams({ from: monthStart.toISOString(), to: monthEnd.toISOString() });
    if (calendarPlantId) params.set("plantId", calendarPlantId);
    fetch(`/api/maintenance/executions?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setCalendarExecutions(d.executions ?? []));
  }, [calendarMonth, calendarPlantId]);

  useEffect(() => {
    if (plants.length > 0 && !calendarPlantId) setCalendarPlantId(plants[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants]);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(t: Task) {
    setForm({
      plantId: t.plantId,
      equipmentId: t.equipmentId ?? "",
      title: t.title,
      description: t.description ?? "",
      category: t.category ?? "",
      frequency: t.frequency,
      scheduledMonths: t.scheduledMonths,
      requiredTechnicians: t.requiredTechnicians,
      assignedRole: t.assignedRole ?? "",
      assignedUserId: t.assignedUserId ?? "",
    });
    setEditingId(t.id);
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        equipmentId: form.equipmentId || undefined,
        assignedRole: form.assignedRole || undefined,
        assignedUserId: form.assignedUserId || undefined,
        description: form.description || undefined,
        category: form.category || undefined,
      };
      const res = await fetch(editingId ? `/api/maintenance/tasks/${editingId}` : "/api/maintenance/tasks", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setShowForm(false);
      loadTasks();
      loadStats();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: Task) {
    await fetch(`/api/maintenance/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    loadTasks();
    loadStats();
  }

  async function handleDelete(t: Task) {
    if (!confirm(`Excluir a atividade "${t.title}"? Todo o histórico de execuções também será removido.`)) return;
    await fetch(`/api/maintenance/tasks/${t.id}`, { method: "DELETE" });
    loadTasks();
    loadStats();
  }

  function toggleMonth(m: number) {
    setForm((f) => ({
      ...f,
      scheduledMonths: f.scheduledMonths.includes(m) ? f.scheduledMonths.filter((x) => x !== m) : [...f.scheduledMonths, m].sort((a, b) => a - b),
    }));
  }

  function openExecution(ex: Execution) {
    setSelectedExecution(ex);
    setReviewNotesDraft(ex.reviewNotes ?? "");
  }

  async function submitReview(reviewStatus: ReviewStatus) {
    if (!selectedExecution) return;
    setReviewSaving(true);
    try {
      const res = await fetch(`/api/maintenance/executions/${selectedExecution.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", reviewStatus, reviewNotes: reviewNotesDraft || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedExecution({ ...selectedExecution, ...data.execution });
        loadExecutions();
      }
    } finally {
      setReviewSaving(false);
    }
  }

  function goToDay(dateStr: string, plantId: string) {
    setExecFilters({ plantId, date: dateStr, userId: "", status: "", frequency: "" });
    setTab("execucoes");
  }

  const equipmentForPlant = equipment.filter((e) => e.plantId === form.plantId);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterPlant && t.plantId !== filterPlant) return false;
      if (filterFrequency && t.frequency !== filterFrequency) return false;
      if (q && !`${t.title} ${t.category ?? ""} ${t.assignedRole ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, filterPlant, filterFrequency, search]);

  const executionsByPlantThenTech = useMemo(() => {
    const byPlant = new Map<string, { plantName: string; groups: Map<string, { techName: string; phone: string | null; items: Execution[] }> }>();
    for (const ex of executions) {
      const plantEntry = byPlant.get(ex.task.plant.id) ?? { plantName: ex.task.plant.name, groups: new Map() };
      const tech = ex.user ?? technicians.find((t) => t.id === ex.task.assignedUserId) ?? null;
      const techKey = tech?.id ?? "unassigned";
      const techEntry = plantEntry.groups.get(techKey) ?? {
        techName: tech?.name ?? "Não atribuído",
        phone: (tech as TechUser)?.phone ?? null,
        items: [],
      };
      techEntry.items.push(ex);
      plantEntry.groups.set(techKey, techEntry);
      byPlant.set(ex.task.plant.id, plantEntry);
    }
    return [...byPlant.entries()];
  }, [executions, technicians]);

  const isFilteringToday = execFilters.date === todayStr();

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dueByDay = new Map<number, number>();
    const completedByDay = new Map<number, number>();
    const overdueByDay = new Map<number, number>();

    for (const ex of calendarExecutions) {
      const due = new Date(ex.dueDate);
      if (due.getFullYear() === year && due.getMonth() === month) {
        const d = due.getDate();
        dueByDay.set(d, (dueByDay.get(d) ?? 0) + 1);
        if (ex.status === "ATRASADA") overdueByDay.set(d, (overdueByDay.get(d) ?? 0) + 1);
      }
      if (ex.completedAt) {
        const completed = new Date(ex.completedAt);
        if (completed.getFullYear() === year && completed.getMonth() === month) {
          const d = completed.getDate();
          completedByDay.set(d, (completedByDay.get(d) ?? 0) + 1);
        }
      }
    }

    const cells: { day: number | null; due: number; completed: number; overdue: number }[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, due: 0, completed: 0, overdue: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, due: dueByDay.get(d) ?? 0, completed: completedByDay.get(d) ?? 0, overdue: overdueByDay.get(d) ?? 0 });
    }
    return cells;
  }, [calendarMonth, calendarExecutions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Plano de Manutenção</h1>
          <p className="text-sm text-slate-500">Cronograma de atividades, execuções em campo e indicadores</p>
        </div>
        <div className="flex gap-2 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            onClick={() => setTab("execucoes")}
            className={`rounded-md px-3 py-1.5 font-medium ${tab === "execucoes" ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            Execuções
          </button>
          <button
            onClick={() => setTab("cronograma")}
            className={`rounded-md px-3 py-1.5 font-medium ${tab === "cronograma" ? "bg-white shadow-sm" : "text-slate-500"}`}
          >
            Cronograma
          </button>
        </div>
      </div>

      {tab === "execucoes" && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="Pendentes hoje" value={stats.overall.PENDENTE} color="text-slate-700" />
              <StatCard label="Em andamento hoje" value={stats.overall.EM_ANDAMENTO} color="text-blue-600" />
              <StatCard label="Concluídas hoje" value={stats.overall.CONCLUIDA} color="text-emerald-600" />
              <StatCard label="Atrasadas hoje" value={stats.overall.ATRASADA} color="text-red-600" />
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <FilterField label="Usina">
              <select
                value={execFilters.plantId}
                onChange={(e) => setExecFilters((f) => ({ ...f, plantId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Data">
              <input
                type="date"
                value={execFilters.date}
                onChange={(e) => setExecFilters((f) => ({ ...f, date: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </FilterField>
            <FilterField label="Técnico">
              <select
                value={execFilters.userId}
                onChange={(e) => setExecFilters((f) => ({ ...f, userId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Status">
              <select
                value={execFilters.status}
                onChange={(e) => setExecFilters((f) => ({ ...f, status: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="CONCLUIDA">Concluído</option>
                <option value="NAO_CONCLUIDA">Não concluído</option>
                <option value="ATRASADA">Atrasado</option>
              </select>
            </FilterField>
            <FilterField label="Periodicidade">
              <select
                value={execFilters.frequency}
                onChange={(e) => setExecFilters((f) => ({ ...f, frequency: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FilterField>
            {execFilters.date !== todayStr() && (
              <button
                onClick={() => setExecFilters((f) => ({ ...f, date: todayStr() }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
              >
                Voltar para hoje
              </button>
            )}
          </div>

          {loadingExecutions && <p className="text-sm text-slate-400">Carregando...</p>}

          {!loadingExecutions &&
            executionsByPlantThenTech.map(([plantId, { plantName, groups }]) => (
              <div key={plantId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">☀️ {plantName}</h2>
                <div className="space-y-4">
                  {[...groups.entries()].map(([techKey, group]) => (
                    <div key={techKey} className="rounded-lg border border-slate-100 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">
                          👷 {group.techName} <span className="text-xs font-normal text-slate-400">({group.items.length} atividade(s))</span>
                        </p>
                        {isFilteringToday && group.phone && (
                          <a
                            href={buildWhatsAppLink(group.phone, group.techName, plantName, group.items)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                          >
                            📲 Enviar resumo por WhatsApp
                          </a>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {group.items.map((ex) => (
                          <button
                            key={ex.id}
                            onClick={() => openExecution(ex)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100"
                          >
                            <div>
                              <p className="font-medium text-slate-700">{ex.task.title}</p>
                              <p className="text-slate-400">
                                {FREQUENCY_LABELS[ex.task.frequency]}
                                {ex.task.equipment ? ` · ${ex.task.equipment.name}` : ""} · prazo{" "}
                                {new Date(ex.dueDate).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {ex.reviewStatus && (
                                <span className={`rounded-full px-2 py-0.5 font-medium ${REVIEW_COLOR[ex.reviewStatus]}`}>
                                  {REVIEW_STATUS_LABELS[ex.reviewStatus]}
                                </span>
                              )}
                              <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[ex.status]}`}>{STATUS_LABELS[ex.status]}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {!loadingExecutions && executions.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma atividade encontrada para os filtros selecionados.</p>
          )}
        </div>
      )}

      {tab === "cronograma" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">📅 Calendário de execuções</h2>
              <div className="flex items-center gap-2">
                <select
                  value={calendarPlantId}
                  onChange={(e) => setCalendarPlantId(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                >
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  ←
                </button>
                <span className="w-32 text-center text-sm font-medium text-slate-700">
                  {calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  →
                </button>
              </div>
            </div>

            <div className="mb-2 flex gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> Previstas
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Executadas
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Atrasadas
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell, i) =>
                cell.day === null ? (
                  <div key={i} className="aspect-square rounded-lg" />
                ) : (
                  <button
                    key={i}
                    onClick={() =>
                      goToDay(
                        `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`,
                        calendarPlantId
                      )
                    }
                    className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-100 text-xs hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{cell.day}</span>
                    <span className="flex gap-0.5">
                      {cell.due > 0 && <span className="h-1.5 w-1.5 rounded-full bg-slate-400" title={`${cell.due} previstas`} />}
                      {cell.completed > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title={`${cell.completed} executadas`} />}
                      {cell.overdue > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" title={`${cell.overdue} atrasadas`} />}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <select value={filterPlant} onChange={(e) => setFilterPlant(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Todas as usinas</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={filterFrequency}
                onChange={(e) => setFilterFrequency(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todas as frequências</option>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, categoria, equipe..."
                className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button onClick={openCreate} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              + Nova atividade
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="px-4 py-3">Atividade</th>
                  <th className="px-4 py-3">Usina</th>
                  <th className="px-4 py-3">Frequência</th>
                  <th className="px-4 py-3">Equipe</th>
                  <th className="px-4 py-3">Técnico</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{t.title}</p>
                      {t.category && <p className="text-xs text-slate-400">{t.category}</p>}
                    </td>
                    <td className="px-4 py-3">{t.plant.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {FREQUENCY_LABELS[t.frequency]}
                      </span>
                      {t.scheduledMonths.length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">{t.scheduledMonths.map((m) => MONTHS[m - 1]).join(", ")}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.assignedRole ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.assignedUser?.name ?? "Não atribuído"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {t.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="space-x-2 px-4 py-3 text-xs">
                      <button onClick={() => openEdit(t)} className="text-slate-600 underline">
                        Editar
                      </button>
                      <button onClick={() => toggleActive(t)} className="text-slate-600 underline">
                        {t.active ? "Inativar" : "Ativar"}
                      </button>
                      <button onClick={() => handleDelete(t)} className="text-red-600 underline">
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma atividade encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{editingId ? "Editar atividade" : "Nova atividade"}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Usina</label>
                <select
                  required
                  value={form.plantId}
                  onChange={(e) => setForm({ ...form, plantId: e.target.value, equipmentId: "" })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Selecione</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Equipamento (opcional — exige leitura de QR Code)</label>
                <select
                  value={form.equipmentId}
                  onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Atividade geral (sem QR Code)</option>
                  {equipmentForPlant.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Título / Equipamento-Sistema</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Descrição da atividade</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Categoria</label>
                <input
                  list="category-suggestions"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <datalist id="category-suggestions">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Frequência</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as MaintenanceFrequency })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {(form.frequency === "TRIMESTRAL" || form.frequency === "SEMESTRAL" || form.frequency === "ANUAL") && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Meses em que ocorre (deixe vazio para repetir automaticamente todo período)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTHS.map((label, i) => {
                      const m = i + 1;
                      const active = form.scheduledMonths.includes(m);
                      return (
                        <button
                          type="button"
                          key={m}
                          onClick={() => toggleMonth(m)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                            active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Mantenedores necessários</label>
                <input
                  type="number"
                  min={1}
                  value={form.requiredTechnicians}
                  onChange={(e) => setForm({ ...form, requiredTechnicians: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Equipe / Responsável (papel)</label>
                <input
                  list="role-suggestions"
                  value={form.assignedRole}
                  onChange={(e) => setForm({ ...form, assignedRole: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <datalist id="role-suggestions">
                  {ROLE_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Técnico designado (opcional — vazio = qualquer técnico pode executar)</label>
                <select
                  value={form.assignedUserId}
                  onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Não atribuído</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar atividade"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedExecution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedExecution(null)}>
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[selectedExecution.status]}`}>
                    {STATUS_LABELS[selectedExecution.status]}
                  </span>
                  {selectedExecution.reviewStatus && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_COLOR[selectedExecution.reviewStatus]}`}>
                      {REVIEW_STATUS_LABELS[selectedExecution.reviewStatus]}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedExecution.task.title}</h2>
                {selectedExecution.task.description && <p className="mt-1 text-sm text-slate-500">{selectedExecution.task.description}</p>}
              </div>
              <button onClick={() => setSelectedExecution(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                ✕
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Row label="Usina" value={selectedExecution.task.plant.name} />
              <Row label="Equipamento" value={selectedExecution.task.equipment?.name ?? "Atividade geral"} />
              <Row label="Frequência" value={FREQUENCY_LABELS[selectedExecution.task.frequency]} />
              <Row label="Prazo" value={new Date(selectedExecution.dueDate).toLocaleDateString("pt-BR")} />
              <Row label="Técnico" value={selectedExecution.user?.name ?? "—"} />
              <Row label="Concluída em" value={selectedExecution.completedAt ? new Date(selectedExecution.completedAt).toLocaleString("pt-BR") : "—"} />
              <Row
                label="Localização"
                value={
                  selectedExecution.latitude != null && selectedExecution.longitude != null
                    ? `${selectedExecution.latitude.toFixed(6)}, ${selectedExecution.longitude.toFixed(6)}`
                    : "—"
                }
              />
            </dl>

            {selectedExecution.notes && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Observações do técnico</p>
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{selectedExecution.notes}</p>
              </div>
            )}

            {selectedExecution.photoUrls.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Fotos ({selectedExecution.photoUrls.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedExecution.photoUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Foto ${i + 1}`} className="h-24 w-full rounded-lg border border-slate-200 object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedExecution.status === "CONCLUIDA" && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Aprovação do gestor</p>
                {selectedExecution.reviewer && (
                  <p className="mb-2 text-xs text-slate-400">
                    Última avaliação por {selectedExecution.reviewer.name}
                    {selectedExecution.reviewStatus ? `: ${REVIEW_STATUS_LABELS[selectedExecution.reviewStatus]}` : ""}
                  </p>
                )}
                <textarea
                  value={reviewNotesDraft}
                  onChange={(e) => setReviewNotesDraft(e.target.value)}
                  rows={2}
                  placeholder="Comentário para o técnico (opcional)"
                  className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    disabled={reviewSaving}
                    onClick={() => submitReview("APROVADO")}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    ✓ Aprovar
                  </button>
                  <button
                    disabled={reviewSaving}
                    onClick={() => submitReview("CORRIGIR")}
                    className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-400 disabled:opacity-60"
                  >
                    ↻ Corrigir
                  </button>
                  <button
                    disabled={reviewSaving}
                    onClick={() => submitReview("REPROVADO")}
                    className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                  >
                    ✕ Reprovar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
