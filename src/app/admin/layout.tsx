import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "VIGILANTE") redirect("/scan");
  if (session.role === "TECNICO_MANUTENCAO") redirect("/manutencao");

  return (
    <AdminShell userName={session.name} role={session.role}>
      {children}
    </AdminShell>
  );
}
