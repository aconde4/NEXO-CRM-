"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import type { CustomFieldDef } from "@/lib/custom-fields";
import { IMPORT_FIELDS, guessMapping } from "@/lib/import/fields";
import { detectFormat, parseFile, type ParsedFile } from "@/lib/import/parse";
import { importRowSchema } from "@/lib/validations/import";
import { cn } from "@/lib/utils";
import {
  importContacts,
  type ImportSummary,
  type RawImportRow,
} from "@/server/actions/import-contacts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Step = "upload" | "map" | "preview" | "result";

type Mapping = Record<string, number | null>;

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Archivo" },
  { id: "map", label: "Mapeo" },
  { id: "preview", label: "Vista previa" },
  { id: "result", label: "Resultado" },
];

const SAMPLE_CSV =
  "Nombre,Apellidos,Email,Teléfono,Cargo,Empresa,Origen\n" +
  "Ana,García,ana.garcia@ejemplo.com,+34 600 111 222,Directora,Acme S.L.,Web\n" +
  "Carlos,Ruiz,carlos.ruiz@ejemplo.com,,CTO,Acme S.L.,Referido\n";

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function isEmptyRaw(raw: RawImportRow): boolean {
  const { customFields, ...rest } = raw;
  const hasBuiltin = Object.values(rest).some((v) => v && v.trim());
  const hasCustom = customFields
    ? Object.values(customFields).some((v) => v != null && String(v).trim())
    : false;
  return !hasBuiltin && !hasCustom;
}

function buildRow(
  row: string[],
  mapping: Mapping,
  customDefs: CustomFieldDef[],
): RawImportRow {
  const get = (key: string) => {
    const idx = mapping[key];
    return idx == null ? undefined : row[idx];
  };
  const customFields: Record<string, unknown> = {};
  for (const def of customDefs) {
    const value = get(`cf:${def.key}`);
    if (value !== undefined && String(value).trim() !== "")
      customFields[def.key] = value;
  }
  return {
    firstName: get("firstName"),
    lastName: get("lastName"),
    email: get("email"),
    phone: get("phone"),
    title: get("title"),
    orgName: get("orgName"),
    source: get("source"),
    customFields,
  };
}

type RowStatus = "ready" | "dup" | "error" | "empty";

function analyze(rows: RawImportRow[]) {
  const seen = new Set<string>();
  const detail = rows.map((raw) => {
    if (isEmptyRaw(raw)) return { status: "empty" as RowStatus };
    const candidate = {
      firstName: clean(raw.firstName),
      lastName: clean(raw.lastName),
      email: clean(raw.email),
      phone: clean(raw.phone),
      title: clean(raw.title),
      orgName: clean(raw.orgName),
      source: clean(raw.source),
    };
    const parsed = importRowSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        status: "error" as RowStatus,
        message: parsed.error.issues[0]?.message ?? "Fila no válida",
        raw: candidate,
      };
    }
    const email = parsed.data.email?.toLowerCase();
    if (email && seen.has(email))
      return { status: "dup" as RowStatus, raw: candidate };
    if (email) seen.add(email);
    return { status: "ready" as RowStatus, raw: candidate };
  });

  const counts = { ready: 0, dup: 0, error: 0 };
  for (const d of detail) {
    if (d.status === "ready") counts.ready++;
    else if (d.status === "dup") counts.dup++;
    else if (d.status === "error") counts.error++;
  }
  return { detail, counts };
}

export function ImportWizard({
  customFieldDefs = [],
}: {
  customFieldDefs?: CustomFieldDef[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("upload");
  const [fileName, setFileName] = React.useState("");
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null);
  const [mapping, setMapping] = React.useState<Mapping | null>(null);
  const [dedupe, setDedupe] = React.useState<"skip" | "update">("skip");
  const [parsing, setParsing] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const mappedRows = React.useMemo(
    () =>
      parsed && mapping
        ? parsed.rows.map((r) => buildRow(r, mapping, customFieldDefs))
        : [],
    [parsed, mapping, customFieldDefs],
  );
  const analysis = React.useMemo(() => analyze(mappedRows), [mappedRows]);

  async function handleFile(file: File) {
    if (!detectFormat(file)) {
      toast.error("Formato no soportado. Usa un archivo .csv o .xlsx.");
      return;
    }
    setParsing(true);
    try {
      const result = await parseFile(file);
      if (result.headers.length === 0 || result.rows.length === 0) {
        toast.error("El archivo no tiene datos o cabeceras.");
        return;
      }
      setParsed(result);
      setMapping(
        guessMapping(
          result.headers,
          customFieldDefs.map((d) => ({ key: d.key, label: d.label })),
        ),
      );
      setFileName(file.name);
      setStep("map");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo leer el archivo.",
      );
    } finally {
      setParsing(false);
    }
  }

  function downloadSample() {
    const blob = new Blob(["﻿" + SAMPLE_CSV], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-contactos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    setImporting(true);
    try {
      const result = await importContacts(mappedRows, { dedupe });
      setSummary(result);
      setStep("result");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo importar.",
      );
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("upload");
    setParsed(null);
    setMapping(null);
    setFileName("");
    setSummary(null);
    setDedupe("skip");
  }

  const firstNameMapped = mapping?.firstName != null;

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      {step === "upload" ? (
        <Card>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="bg-primary/10 text-primary mb-4 flex size-12 items-center justify-center rounded-xl">
                {parsing ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <FileUp className="size-6" />
                )}
              </div>
              <p className="font-medium">
                {parsing ? "Leyendo archivo…" : "Arrastra tu archivo aquí"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                CSV o Excel (.xlsx). La primera fila debe ser la cabecera.
              </p>
              <label className="mt-4">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx"
                  className="sr-only"
                  disabled={parsing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = "";
                  }}
                />
                <span
                  className={cn(
                    "bg-primary text-primary-foreground inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-medium shadow-xs transition hover:opacity-90",
                    parsing && "pointer-events-none opacity-50",
                  )}
                >
                  <Upload className="size-4" />
                  Elegir archivo
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={downloadSample}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <Download className="size-3.5" />
                Descargar plantilla de ejemplo
              </button>
              <span className="text-muted-foreground/80 text-xs">
                Los duplicados se detectan por email.
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "map" && parsed && mapping ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="text-muted-foreground size-4" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">
                · {parsed.headers.length} columnas · {parsed.rows.length} filas
              </span>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Asigna las columnas</p>
              <div className="space-y-2">
                {IMPORT_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr]"
                  >
                    <Label className="text-sm">
                      {field.label}
                      {field.required ? (
                        <span className="text-destructive"> *</span>
                      ) : null}
                    </Label>
                    <select
                      className={selectClass}
                      value={mapping[field.key] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m!,
                          [field.key]:
                            e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    >
                      <option value="">— No importar —</option>
                      {parsed.headers.map((header, i) => (
                        <option key={i} value={i}>
                          {header || `Columna ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                {customFieldDefs.map((def) => (
                  <div
                    key={def.id}
                    className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr]"
                  >
                    <Label className="text-sm">{def.label}</Label>
                    <select
                      className={selectClass}
                      value={mapping[`cf:${def.key}`] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m!,
                          [`cf:${def.key}`]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }))
                      }
                    >
                      <option value="">— No importar —</option>
                      {parsed.headers.map((header, i) => (
                        <option key={i} value={i}>
                          {header || `Columna ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Si el email ya existe</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <DedupeOption
                  active={dedupe === "skip"}
                  onClick={() => setDedupe("skip")}
                  title="Omitir"
                  description="No se toca el contacto existente."
                />
                <DedupeOption
                  active={dedupe === "update"}
                  onClick={() => setDedupe("update")}
                  title="Actualizar"
                  description="Se actualizan sus datos con los del archivo."
                />
              </div>
            </div>

            {!firstNameMapped ? (
              <p className="text-destructive text-sm">
                Debes asignar al menos la columna del <strong>Nombre</strong>.
              </p>
            ) : null}

            <div className="flex justify-between">
              <Button variant="outline" onClick={reset}>
                <ArrowLeft />
                Cambiar archivo
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!firstNameMapped}
              >
                Vista previa
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "preview" && parsed ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Summary value={analysis.counts.ready} label="Listos" tone="ok" />
              <Summary
                value={analysis.counts.dup}
                label="Duplicados"
                tone="warn"
              />
              <Summary
                value={analysis.counts.error}
                label="Con error"
                tone="error"
              />
            </div>

            <p className="text-muted-foreground text-xs">
              Vista previa de las primeras filas. La deduplicación contra tus
              contactos existentes se aplica al importar.
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground border-b text-left text-xs">
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Empresa</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.detail
                    .filter((d) => d.status !== "empty")
                    .slice(0, 12)
                    .map((d, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <StatusBadge status={d.status} message={d.message} />
                        </td>
                        <td className="px-3 py-2">
                          {[d.raw?.firstName, d.raw?.lastName]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {d.raw?.email || "—"}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {d.raw?.orgName || "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("map")}>
                <ArrowLeft />
                Volver al mapeo
              </Button>
              <Button
                onClick={runImport}
                disabled={importing || analysis.counts.ready === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Importando…
                  </>
                ) : (
                  <>
                    Importar {analysis.counts.ready} contactos
                    <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "result" && summary ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="text-lg font-semibold">Importación completada</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {summary.total} filas procesadas.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Summary value={summary.created} label="Creados" tone="ok" />
              <Summary value={summary.updated} label="Actualizados" tone="info" />
              <Summary value={summary.skipped} label="Omitidos" tone="warn" />
            </div>

            {summary.errors.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-destructive mb-1.5 text-sm font-medium">
                  {summary.errors.length} filas con error
                </p>
                <ul className="text-muted-foreground max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {summary.errors.slice(0, 50).map((e) => (
                    <li key={e.row}>
                      Fila {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-between">
              <Button variant="outline" onClick={reset}>
                <Upload />
                Importar otro archivo
              </Button>
              <Button render={<Link href="/contacts" />}>
                Ver contactos
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <React.Fragment key={s.id}>
            <li className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                  "hidden sm:inline",
                )}
              >
                {s.label}
              </span>
            </li>
            {i < STEPS.length - 1 ? (
              <li
                aria-hidden
                className="bg-border h-px w-4 flex-1 sm:w-8 sm:flex-none"
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function DedupeOption({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-primary/20 ring-1"
          : "hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span
          className={cn(
            "flex size-4 items-center justify-center rounded-full border",
            active ? "border-primary" : "border-muted-foreground/40",
          )}
        >
          {active ? <span className="bg-primary size-2 rounded-full" /> : null}
        </span>
        {title}
      </span>
      <span className="text-muted-foreground mt-1 block pl-6 text-xs">
        {description}
      </span>
    </button>
  );
}

const toneClass: Record<string, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
  info: "text-primary",
};

function Summary({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: keyof typeof toneClass;
}) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={cn("text-2xl font-semibold tabular-nums", toneClass[tone])}>
        {value}
      </p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function StatusBadge({
  status,
  message,
}: {
  status: RowStatus;
  message?: string;
}) {
  if (status === "ready")
    return (
      <Badge variant="secondary" className="font-normal">
        Listo
      </Badge>
    );
  if (status === "dup")
    return (
      <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
        Duplicado
      </Badge>
    );
  return (
    <Badge variant="destructive" className="font-normal" title={message}>
      {message ?? "Error"}
    </Badge>
  );
}
