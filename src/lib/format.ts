/** Iniciales a partir de un nombre (1-2 letras). */
export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Nombre completo a partir de nombre + apellidos. */
export function fullName(first: string, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return dateFormatter.format(d);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormatter.format(d);
}

/** Importe con moneda ("1.500 €"); sin decimales si es entero. */
export function formatMoney(value: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Importe abreviado para tarjetas ("1,5 k €", "2,3 M €"). */
export function formatMoneyCompact(value: number, currency = "EUR"): string {
  if (Math.abs(value) >= 1000) {
    const compact = new Intl.NumberFormat("es-ES", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
    const symbol = currency === "EUR" ? "€" : currency;
    return `${compact} ${symbol}`;
  }
  return formatMoney(value, currency);
}

/** Tamaño de archivo legible ("1,2 MB"). */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  const rounded = i === 0 ? value : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[i]}`;
}

/** Fecha relativa sencilla en español ("hace 3 días"). */
export function relativeDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hour = Math.round(min / 60);
  const day = Math.round(hour / 24);
  if (sec < 60) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (hour < 24) return `hace ${hour} h`;
  if (day < 30) return `hace ${day} ${day === 1 ? "día" : "días"}`;
  return formatDate(d);
}
