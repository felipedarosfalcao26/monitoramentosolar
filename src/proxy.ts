import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// Only ADMIN may pass.
const ADMIN_ONLY_PREFIXES = ["/admin/users"];

// GESTOR may only GET this (e.g. to list vigilantes for a report filter) — no writes, and never a field role.
const ADMIN_WRITE_GESTOR_READ_PREFIXES = ["/api/users"];

// Pages under /admin are back-office only; a field role is redirected home.
const BACK_OFFICE_PAGE_PREFIXES = ["/admin"];

// Field-role mobile pages, each restricted to its own role below.
const VIGILANTE_ONLY_PAGE_PREFIXES = ["/scan"];
const TECNICO_ONLY_PAGE_PREFIXES = ["/manutencao"];

// API prefixes a VIGILANTE may always use (their own field-work endpoints).
const VIGILANTE_API_ALLOWLIST = [
  "/api/auth",
  "/api/scans",
  "/api/qr",
  "/api/qrcodes",
  "/api/rounds",
  "/api/occurrences",
  "/api/uploads",
];

// API prefixes a TECNICO_MANUTENCAO may always use (their own field-work endpoints).
const TECNICO_API_ALLOWLIST = ["/api/auth", "/api/maintenance", "/api/qr", "/api/qrcodes", "/api/uploads"];

// Everything else under /api is back-office (blocked for field roles) unless allowlisted above.
const BACK_OFFICE_API_PREFIXES = ["/api/equipment", "/api/reports", "/api/dashboard", "/api/alerts", "/api/staticmap"];

// A field role may only GET these (e.g. to pick a usina when starting a round/task) — no writes.
const FIELD_READ_ONLY_PREFIXES = ["/api/routes", "/api/plants"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p) || pathname.startsWith("/_next") || pathname.startsWith("/manifest")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const deny = () =>
    pathname.startsWith("/api")
      ? NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      : NextResponse.redirect(new URL("/", request.url));

  if (ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && session.role !== "ADMIN") {
    return deny();
  }

  if (ADMIN_WRITE_GESTOR_READ_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (session.role === "VIGILANTE" || session.role === "TECNICO_MANUTENCAO") return deny();
    if (session.role === "GESTOR" && request.method !== "GET") return deny();
  }

  if (session.role === "VIGILANTE" || session.role === "TECNICO_MANUTENCAO") {
    const isVigilante = session.role === "VIGILANTE";
    const apiAllowlist = isVigilante ? VIGILANTE_API_ALLOWLIST : TECNICO_API_ALLOWLIST;
    const foreignPagePrefixes = isVigilante ? TECNICO_ONLY_PAGE_PREFIXES : VIGILANTE_ONLY_PAGE_PREFIXES;

    if (BACK_OFFICE_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) return deny();
    if (foreignPagePrefixes.some((p) => pathname.startsWith(p))) return deny();
    if (BACK_OFFICE_API_PREFIXES.some((p) => pathname.startsWith(p)) && !apiAllowlist.some((p) => pathname.startsWith(p))) {
      return deny();
    }
    if (FIELD_READ_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && request.method !== "GET") {
      return deny();
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-user-id", session.sub);
  response.headers.set("x-user-role", session.role);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
