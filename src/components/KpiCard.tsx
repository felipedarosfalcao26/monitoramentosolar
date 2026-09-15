import Link from "next/link";
import { TrendDownIcon, TrendUpIcon } from "@/components/icons";

type KpiCardProps = {
  label: string;
  value: string | number;
  icon?: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  tone?: "slate" | "accent" | "emerald" | "amber" | "red" | "violet";
  trend?: { value: number; label?: string };
  href?: string;
};

const TONE_CLASSES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  slate: "bg-slate-100 text-slate-600",
  accent: "bg-accent-50 text-accent-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
};

export default function KpiCard({ label, value, icon: Icon, tone = "slate", trend, href }: KpiCardProps) {
  const content = (
    <div className="card-shadow card-shadow-hover group rounded-2xl border border-slate-200/70 bg-white p-4 transition-shadow duration-200">
      <div className="flex items-start justify-between">
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONE_CLASSES[tone]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
        {trend && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
              trend.value >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            {trend.value >= 0 ? <TrendUpIcon className="h-3 w-3" /> : <TrendDownIcon className="h-3 w-3" />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="tabular-nums mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      {trend?.label && <p className="mt-1 text-[10.5px] text-slate-400">{trend.label}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
