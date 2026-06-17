/**
 * Serialización a CSV (RFC 4180) para exportaciones. Añade BOM UTF-8 para que
 * Excel/Numbers abran bien los acentos, y usa CRLF como salto de línea.
 */

const BOM = String.fromCharCode(0xfeff);

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return BOM + lines.join("\r\n");
}

/** Nombre de archivo con fecha: `prefijo-2026-06-17.csv`. */
export function csvFilename(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.csv`;
}
