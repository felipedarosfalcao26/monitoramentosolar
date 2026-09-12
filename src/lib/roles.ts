export const ROLES = ["ADMIN", "GESTOR", "VIGILANTE"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  VIGILANTE: "Vigilante",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
