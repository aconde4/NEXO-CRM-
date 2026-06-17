/**
 * Lectura de archivos CSV y Excel (.xlsx) en el navegador para la importación.
 * Devuelve cabeceras + filas como matriz de cadenas, normalizando el ancho de
 * cada fila al número de columnas de la cabecera.
 */
import Papa from "papaparse";
import { readSheet } from "read-excel-file/universal";

export type ParsedFile = {
  headers: string[];
  rows: string[][];
};

export type SupportedFormat = "csv" | "xlsx";

export function detectFormat(file: File): SupportedFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt"))
    return "csv";
  if (name.endsWith(".xlsx")) return "xlsx";
  return null;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const format = detectFormat(file);
  if (format === "xlsx") return parseXlsx(file);
  if (format === "csv") return parseCsv(file);
  throw new Error("Formato no soportado. Usa un archivo .csv o .xlsx.");
}

function toMatrix(headerRow: string[], rest: string[][]): ParsedFile {
  const headers = headerRow.map((h) => (h ?? "").trim());
  const rows = rest
    .map((row) => headers.map((_, i) => (row[i] ?? "").toString().trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
  return { headers, rows };
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (result) => {
        const data = result.data;
        if (!data.length) return resolve({ headers: [], rows: [] });
        const [headerRow, ...rest] = data as string[][];
        resolve(toMatrix(headerRow ?? [], rest));
      },
      error: (error) => reject(error),
    });
  });
}

function cellToString(cell: unknown): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell);
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const matrix = await readSheet(file);
  if (!matrix.length) return { headers: [], rows: [] };
  const [headerRow, ...rest] = matrix;
  return toMatrix(
    (headerRow ?? []).map(cellToString),
    rest.map((row) => row.map(cellToString)),
  );
}
