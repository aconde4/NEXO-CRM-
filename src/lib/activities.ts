/**
 * Metadatos y utilidades de actividades/tareas (Fase 1.10). Se usa tanto en
 * componentes de servidor como de cliente: solo depende de `lucide-react`.
 */
import {
  Coffee,
  Flag,
  ListTodo,
  Mail,
  Phone,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Tipos de actividad, en el orden en que se ofrecen al usuario. */
export const ACTIVITY_TYPES = [
  "task",
  "call",
  "meeting",
  "email",
  "deadline",
  "lunch",
] as const;

export type ActivityTypeValue = (typeof ACTIVITY_TYPES)[number];

export const activityTypeMeta: Record<
  ActivityTypeValue,
  { label: string; icon: LucideIcon }
> = {
  task: { label: "Tarea", icon: ListTodo },
  call: { label: "Llamada", icon: Phone },
  meeting: { label: "Reunión", icon: Users },
  email: { label: "Email", icon: Mail },
  deadline: { label: "Vencimiento", icon: Flag },
  lunch: { label: "Comida", icon: Coffee },
};

/** Devuelve los metadatos del tipo, con respaldo seguro a "task". */
export function metaForType(type: string) {
  return activityTypeMeta[type as ActivityTypeValue] ?? activityTypeMeta.task;
}

// --- Vencimientos -----------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function atStartOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Días naturales entre dos fechas (a − b): 0 = mismo día, 1 = mañana, −1 = ayer. */
export function dayDiff(a: Date, b: Date): number {
  return Math.round(
    (atStartOfDay(a).getTime() - atStartOfDay(b).getTime()) / 86_400_000,
  );
}

/** ¿La tarea está vencida? (tiene fecha, no está hecha y ya pasó). */
export function isOverdue(
  dueAt: Date | string | null | undefined,
  done: boolean,
): boolean {
  if (!dueAt || done) return false;
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  return d.getTime() < Date.now();
}

const timeFmt = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayMonthFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
});
const dayMonthYearFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const weekdayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long" });

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Etiqueta amigable de un vencimiento ("Hoy, 15:30", "Mañana, 09:00", "12 jun, 16:00"). */
export function formatDue(dueAt: Date | string | null | undefined): string {
  if (!dueAt) return "Sin fecha";
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const now = new Date();
  const diff = dayDiff(d, now);
  const time = timeFmt.format(d);

  if (diff === 0) return `Hoy, ${time}`;
  if (diff === 1) return `Mañana, ${time}`;
  if (diff === -1) return `Ayer, ${time}`;
  if (diff > 1 && diff < 7) return `${capitalize(weekdayFmt.format(d))}, ${time}`;
  if (d.getFullYear() === now.getFullYear())
    return `${dayMonthFmt.format(d)}, ${time}`;
  return `${dayMonthYearFmt.format(d)}, ${time}`;
}

/**
 * Convierte una fecha al valor que espera `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm`) en la zona horaria local del navegador.
 */
export function toDateTimeLocal(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
