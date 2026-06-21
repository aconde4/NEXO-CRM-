/**
 * Ventana de envío con zona horaria (Fase 5.6). Lógica pura compartida por el envío de
 * campañas (Fase 4.6) y de secuencias (Fase 5.6): decide si un instante cae dentro de
 * la ventana horaria local y calcula la siguiente apertura. Sin servidor ni BD para
 * poder testearla de forma aislada.
 */

export type SendWindow = {
  timeZone: string;
  /** "HH:MM" en hora local de `timeZone`. */
  windowStart: string;
  /** "HH:MM" en hora local de `timeZone`. */
  windowEnd: string;
};

type TimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

export function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

/** Normaliza un "HH:MM"; si no es válido, devuelve el `fallback`. */
export function parseTime(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  return /^\d{2}:\d{2}$/.test(candidate) ? candidate : fallback;
}

/** Valida una zona IANA; si no es válida, devuelve "Europe/Madrid". */
export function validTimeZone(value: string | undefined): string {
  const timeZone = value?.trim() || "Europe/Madrid";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "Europe/Madrid";
  }
}

function getTimeParts(date: Date, timeZone: string): TimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    month: value("month"),
    second: value("second"),
    year: value("year"),
  };
}

function zonedTimeToUtc(
  parts: Omit<TimeParts, "second">,
  timeZone: string,
): Date {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const rendered = getTimeParts(new Date(guess), timeZone);
  const renderedAsUtc = Date.UTC(
    rendered.year,
    rendered.month - 1,
    rendered.day,
    rendered.hour,
    rendered.minute,
    rendered.second,
  );
  return new Date(guess - (renderedAsUtc - guess));
}

function nextLocalDay(parts: TimeParts): Omit<TimeParts, "second"> {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return {
    day: next.getUTCDate(),
    hour: 0,
    minute: 0,
    month: next.getUTCMonth() + 1,
    year: next.getUTCFullYear(),
  };
}

function minuteIsInsideWindow(
  current: number,
  start: number,
  end: number,
): boolean {
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function isWithinSendWindow(date: Date, window: SendWindow): boolean {
  const parts = getTimeParts(date, window.timeZone);
  return minuteIsInsideWindow(
    parts.hour * 60 + parts.minute,
    timeToMinutes(window.windowStart),
    timeToMinutes(window.windowEnd),
  );
}

/** Inicio del día local (en `timeZone`) que contiene `date`, como instante UTC. */
export function startOfLocalDayUtc(date: Date, timeZone: string): Date {
  const parts = getTimeParts(date, timeZone);
  return zonedTimeToUtc(
    { day: parts.day, hour: 0, minute: 0, month: parts.month, year: parts.year },
    timeZone,
  );
}

/** Apertura de la ventana del día local siguiente a `date`, como instante UTC. */
export function nextDayWindowOpen(date: Date, window: SendWindow): Date {
  const parts = getTimeParts(date, window.timeZone);
  const next = nextLocalDay(parts);
  const [hour = "9", minute = "0"] = window.windowStart.split(":");
  return zonedTimeToUtc(
    { ...next, hour: Number(hour), minute: Number(minute) },
    window.timeZone,
  );
}

/**
 * Si `date` está dentro de la ventana, lo devuelve. Si no, calcula la siguiente
 * apertura de la ventana (hoy si aún no ha empezado, o el día siguiente).
 */
export function nextAllowedSendAt(date: Date, window: SendWindow): Date {
  if (isWithinSendWindow(date, window)) return date;

  const parts = getTimeParts(date, window.timeZone);
  const current = parts.hour * 60 + parts.minute;
  const start = timeToMinutes(window.windowStart);
  const end = timeToMinutes(window.windowEnd);
  const [startHour = "0", startMinute = "0"] = window.windowStart.split(":");

  let target = {
    day: parts.day,
    hour: Number(startHour),
    minute: Number(startMinute),
    month: parts.month,
    year: parts.year,
  };

  if (start < end && current >= end) {
    target = {
      ...nextLocalDay(parts),
      hour: Number(startHour),
      minute: Number(startMinute),
    };
  }

  if (start > end && current < start && current >= end) {
    target = {
      day: parts.day,
      hour: Number(startHour),
      minute: Number(startMinute),
      month: parts.month,
      year: parts.year,
    };
  }

  return zonedTimeToUtc(target, window.timeZone);
}
