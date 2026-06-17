/**
 * Campos del CRM a los que se pueden mapear las columnas de un archivo importado.
 * (Campos de serie de contacto; los personalizados llegarán con la tarea 1.8.)
 */

export type ImportFieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "title"
  | "orgName"
  | "source";

export type ImportField = {
  key: ImportFieldKey;
  label: string;
  required?: boolean;
  /** Cabeceras conocidas que mapean a este campo (auto-detección). */
  aliases: string[];
};

export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "firstName",
    label: "Nombre",
    required: true,
    aliases: ["nombre", "first name", "firstname", "name", "nombre de pila"],
  },
  {
    key: "lastName",
    label: "Apellidos",
    aliases: ["apellidos", "apellido", "last name", "lastname", "surname"],
  },
  {
    key: "email",
    label: "Email",
    aliases: ["email", "e-mail", "correo", "correo electronico", "mail"],
  },
  {
    key: "phone",
    label: "Teléfono",
    aliases: ["telefono", "phone", "movil", "tel", "celular", "mobile"],
  },
  {
    key: "title",
    label: "Cargo",
    aliases: ["cargo", "title", "puesto", "job title", "position"],
  },
  {
    key: "orgName",
    label: "Empresa",
    aliases: [
      "empresa",
      "compania",
      "company",
      "organizacion",
      "organization",
    ],
  },
  {
    key: "source",
    label: "Origen",
    aliases: ["origen", "source", "fuente", "procedencia"],
  },
];

/** Minúsculas + sin acentos + sin espacios sobrantes, para comparar cabeceras. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/**
 * Adivina el mapeo columna→campo a partir de las cabeceras del archivo.
 * Devuelve, por cada campo, el índice de columna detectado (o null).
 */
export function guessMapping(
  headers: string[],
): Record<ImportFieldKey, number | null> {
  const normalized = headers.map(normalize);
  const used = new Set<number>();
  const result = {} as Record<ImportFieldKey, number | null>;

  for (const field of IMPORT_FIELDS) {
    const candidates = [field.label, ...field.aliases].map(normalize);
    const index = normalized.findIndex(
      (h, i) => !used.has(i) && h.length > 0 && candidates.includes(h),
    );
    result[field.key] = index >= 0 ? index : null;
    if (index >= 0) used.add(index);
  }

  return result;
}
