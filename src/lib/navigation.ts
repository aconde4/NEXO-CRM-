import {
  BarChart3,
  Building2,
  ClipboardList,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Goal,
  Handshake,
  Package,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Repeat,
  Settings,
  Target,
  UserPlus,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Texto opcional para una insignia (p. ej. nº de pendientes). */
  badge?: string;
  /** Marca funciones aún no construidas (se muestran como "próximamente"). */
  soon?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Navegación principal de la app, agrupada por secciones. */
export const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Panel", href: "/dashboard", icon: LayoutDashboard },
      { title: "Contactos", href: "/contacts", icon: Users },
      { title: "Empresas", href: "/organizations", icon: Building2 },
      { title: "Actividades", href: "/activities", icon: ListChecks },
      { title: "Negocios", href: "/deals", icon: Handshake },
      { title: "Documentos", href: "/documents", icon: FileSignature },
      { title: "Productos", href: "/products", icon: Package },
      { title: "Presupuestos", href: "/quotes", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Comunicación",
    items: [
      { title: "Bandeja", href: "/inbox", icon: Inbox },
      { title: "Segmentos", href: "/segments", icon: Target },
      { title: "Campañas", href: "/campaigns", icon: Megaphone },
      { title: "Secuencias", href: "/sequences", icon: Repeat },
      {
        title: "Automatizaciones",
        href: "/automations",
        icon: Workflow,
      },
      { title: "Formularios", href: "/forms", icon: ClipboardList },
      { title: "Leads", href: "/leads", icon: UserPlus },
    ],
  },
  {
    label: "Análisis",
    items: [
      { title: "Analítica", href: "/analytics", icon: BarChart3 },
      { title: "Objetivos", href: "/analytics/goals", icon: Goal },
      { title: "Informes", href: "/analytics/reports", icon: FileText },
    ],
  },
];

export const settingsNavItem: NavItem = {
  title: "Ajustes",
  href: "/settings",
  icon: Settings,
};

/** Lista plana de todos los ítems, útil para títulos y migas de pan. */
export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  settingsNavItem,
];

/** Devuelve el ítem de navegación que corresponde a una ruta dada. */
export function findNavItem(pathname: string): NavItem | undefined {
  return allNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
