"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";

const NAV_ITEMS: { href: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/map", label: "Mapa", icon: "🗺️" },
  { href: "/admin/plants", label: "Usinas", icon: "☀️" },
  { href: "/admin/equipment", label: "Equipamentos", icon: "🔧" },
  { href: "/admin/reports", label: "Relatórios", icon: "📄" },
  { href: "/admin/users", label: "Usuários", icon: "👤", adminOnly: true },
];

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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            V
          </div>
          <span className="text-sm font-semibold">Vistoria Solar</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN").map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-400">Conectado como</p>
          <p className="truncate text-sm font-medium">{userName}</p>
          <button onClick={logout} className="mt-2 text-xs text-slate-400 underline">
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="text-sm font-semibold">Vistoria Solar</span>
          <button onClick={logout} className="text-xs text-slate-500 underline">
            Sair
          </button>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
