import {
  BarChart3,
  Building2,
  ClipboardList,
  Handshake,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Repeat,
  Settings,
  Target,
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
    ],
  },
  {
    label: "Comunicación",
    items: [
      { title: "Bandeja", href: "/inbox", icon: Inbox },
      { title: "Segmentos", href: "/segments", icon: Target },
      { title: "Campañas", href: "/campaigns", icon: Megaphone },
      { title: "Secuencias", href: "/sequences", icon: Repeat, soon: true },
      {
        title: "Automatizaciones",
        href: "/automations",
        icon: Workflow,
      },
      { title: "Formularios", href: "/forms", icon: ClipboardList },
    ],
  },
  {
    label: "Análisis",
    items: [
      { title: "Analítica", href: "/analytics", icon: BarChart3, soon: true },
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
