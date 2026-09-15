import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(children: React.ReactNode, props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (p: IconProps) =>
  base(
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
    </>,
    p
  );

export const MapIcon = (p: IconProps) =>
  base(
    <>
      <path d="M9 4.5 4 6.5v13l5-2 6 2 5-2v-13l-5 2-6-2Z" />
      <path d="M9 4.5v13" />
      <path d="M15 6.5v13" />
    </>,
    p
  );

export const PlantIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </>,
    p
  );

export const EquipmentIcon = (p: IconProps) =>
  base(
    <>
      <path d="M14.7 6.3a3.5 3.5 0 0 1-4.6 4.6L4 17l3 3 6.1-6.1a3.5 3.5 0 0 1 4.6-4.6l-2.3 2.3-2-2 2.3-2.3Z" />
    </>,
    p
  );

export const MaintenanceIcon = (p: IconProps) =>
  base(
    <>
      <path d="M9.5 3.5a4.5 4.5 0 0 0-1 8.9L4 17.9a1.8 1.8 0 0 0 2.5 2.5l5.5-5.9a4.5 4.5 0 0 0 6-5.6l-3 3-2.4-2.4 3-3a4.6 4.6 0 0 0-1.6-.3 4.5 4.5 0 0 0-4.5 4.5" />
    </>,
    p
  );

export const RouteIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M6 8.2v3a4 4 0 0 0 4 4h1.6a4 4 0 0 1 4 4" strokeDasharray="2.2 2.6" />
    </>,
    p
  );

export const RoundIcon = (p: IconProps) =>
  base(
    <>
      <path d="M12 3.2 4.5 7v6.6c0 4.4 3.2 7 7.5 8.2 4.3-1.2 7.5-3.8 7.5-8.2V7L12 3.2Z" />
      <path d="M9 12.2l2 2 4-4.4" />
    </>,
    p
  );

export const OccurrenceIcon = (p: IconProps) =>
  base(
    <>
      <path d="M12 3.8 2.7 20h18.6L12 3.8Z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="none" />
    </>,
    p
  );

export const ReportIcon = (p: IconProps) =>
  base(
    <>
      <path d="M7 2.8h7.2L18 6.6V21H7z" />
      <path d="M14 2.8V6.6h3.8" />
      <path d="M9.4 12h5.2M9.4 15.4h5.2M9.4 8.6h2.2" />
    </>,
    p
  );

export const UsersIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0" />
      <circle cx="17" cy="8.6" r="2.4" />
      <path d="M15.5 12.6a4.8 4.8 0 0 1 5.3 4.9" />
    </>,
    p
  );

export const ExecutiveIcon = (p: IconProps) => base(<path d="M4 20V10.5M10 20V4M16 20v-7M22 20H2" />, p);

export const LogoutIcon = (p: IconProps) =>
  base(
    <>
      <path d="M9 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" />
      <path d="M13.5 8 17.5 12 13.5 16" />
      <path d="M17 12H8.5" />
    </>,
    p
  );

export const ChevronLeftIcon = (p: IconProps) => base(<path d="M14.5 5 8 12l6.5 7" />, p);
export const ChevronRightIcon = (p: IconProps) => base(<path d="M9.5 5 16 12l-6.5 7" />, p);
export const CloseIcon = (p: IconProps) => base(<path d="M5 5l14 14M19 5 5 19" />, p);
export const CheckIcon = (p: IconProps) => base(<path d="M4.5 12.5 9.5 17.5 19.5 6.5" />, p);
export const PlusIcon = (p: IconProps) => base(<path d="M12 4.5v15M4.5 12h15" />, p);
export const WhatsappIcon = (p: IconProps) =>
  base(
    <>
      <path d="M6.7 17.4 4 20l2.7-0.7a8.3 8.3 0 1 0-1.9-2Z" />
      <path d="M9.1 9.6c0 3.3 2.9 6.1 6.1 6.1 1-.5.9-1.6.6-2l-1.5-.7-1 1a5.3 5.3 0 0 1-2.6-2.6l1-1-.8-1.6c-.3-.3-1.4-.4-1.9.6Z" />
    </>,
    p
  );
export const ClockIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.5V12l3 2" />
    </>,
    p
  );
export const TrendUpIcon = (p: IconProps) => base(<path d="M4 16.5 10 10l3.5 3.5L20 6.5M15.5 6.5H20V11" />, p);
export const TrendDownIcon = (p: IconProps) => base(<path d="M4 7.5 10 14l3.5-3.5L20 17.5M20 13v4.5h-4.5" />, p);
export const ShieldIcon = (p: IconProps) =>
  base(
    <>
      <path d="M12 3 5 5.8v5.6c0 5 3 8 7 9.6 4-1.6 7-4.6 7-9.6V5.8L12 3Z" />
      <path d="M9 12.2l2 2 4-4.4" />
    </>,
    p
  );
export const BellIcon = (p: IconProps) =>
  base(
    <>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.3 5.4 1.3 5.4H4.7S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>,
    p
  );
