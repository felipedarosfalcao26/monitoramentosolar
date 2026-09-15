"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";
import {
  DashboardIcon,
  ExecutiveIcon,
  MapIcon,
  PlantIcon,
  EquipmentIcon,
  MaintenanceIcon,
  RouteIcon,
  RoundIcon,
  OccurrenceIcon,
  ReportIcon,
  UsersIcon,
  LogoutIcon,
} from "@/components/icons";

type NavItem = { href: string; label: string; icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement; adminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: DashboardIcon },
      { href: "/admin/executive", label: "Visão Executiva", icon: ExecutiveIcon },
      { href: "/admin/map", label: "Mapa", icon: MapIcon },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/admin/plants", label: "Usinas", icon: PlantIcon },
      { href: "/admin/equipment", label: "Equipamentos", icon: EquipmentIcon },
      { href: "/admin/maintenance", label: "Manutenção", icon: MaintenanceIcon },
      { href: "/admin/routes", label: "Rotas", icon: RouteIcon },
      { href: "/admin/rounds", label: "Rondas", icon: RoundIcon },
      { href: "/admin/occurrences", label: "Ocorrências", icon: OccurrenceIcon },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/admin/reports", label: "Relatórios", icon: ReportIcon },
      { href: "/admin/users", label: "Usuários", icon: UsersIcon, adminOnly: true },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const ROLE_ACCENT: Record<Role, string> = {
  ADMIN: "bg-accent-600",
  GESTOR: "bg-violet-600",
  VIGILANTE: "bg-emerald-600",
  TECNICO_MANUTENCAO: "bg-orange-600",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function AdminShell({
  children,
  userName,
  role,
}: {
  children: React.ReactNode;
  userName: string;
  role: Role;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const now = useClock();
  const currentItem = ALL_ITEMS.find((item) => pathname.startsWith(item.href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-64 min-h-0 shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-sm font-bold text-white shadow-sm">
            V
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">Vistoria Solar</p>
            <p className="text-[11px] leading-tight text-slate-400">Plataforma de campo</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || role === "ADMIN");
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
                          active ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent-600" />}
                        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-accent-600" : "text-slate-400 group-hover:text-slate-500"}`} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-slate-200/80 px-4 py-3.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${ROLE_ACCENT[role]}`}>
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-800">{userName}</p>
            <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
          </div>
          <button
            onClick={logout}
            title="Sair"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogoutIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3 md:hidden">
          <span className="text-sm font-semibold">Vistoria Solar</span>
          <button onClick={logout} className="text-xs text-slate-500 underline">
            Sair
          </button>
        </header>

        <header className="hidden items-center justify-between border-b border-slate-200/80 bg-white/70 px-8 py-3 backdrop-blur-sm md:flex">
          <p className="text-sm font-medium text-slate-500">{currentItem?.label ?? "Vistoria Solar"}</p>
          {now && (
            <p className="tabular-nums text-xs text-slate-400 capitalize">
              {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
