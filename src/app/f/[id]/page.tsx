import type { Metadata } from "next";

import type { FormFieldDef } from "@/server/db/schema/forms";
import { getPublicForm } from "@/server/queries/forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Formulario" };

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <section className="bg-background w-full max-w-lg rounded-lg border p-6 shadow-sm">
        {children}
      </section>
    </main>
  );
}

function Field({ field }: { field: FormFieldDef }) {
  const id = `f_${field.key}`;
  const common = {
    id,
    name: field.key,
    required: Boolean(field.required),
    placeholder: field.placeholder,
  };

  if (field.type === "checkbox") {
    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          id={id}
          name={field.key}
          value="yes"
          className="size-4 rounded border-input"
        />
        {field.label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </label>
    );
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </label>
      {field.type === "textarea" ? (
        <textarea {...common} rows={4} className={inputClass} />
      ) : field.type === "select" ? (
        <select {...common} className={inputClass} defaultValue="">
          <option value="" disabled>
            — Elige —
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={
            field.type === "email"
              ? "email"
              : field.type === "phone"
                ? "tel"
                : "text"
          }
          className={inputClass}
        />
      )}
    </div>
  );
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const [{ id }, { ok }] = await Promise.all([params, searchParams]);
  const form = await getPublicForm(id);

  if (!form) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Formulario no disponible</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Este formulario no existe o no está publicado.
        </p>
      </Shell>
    );
  }

  if (ok === "1") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">{form.name}</h1>
        <p className="mt-3 text-sm leading-6">
          {form.successMessage || "¡Gracias! Hemos recibido tu respuesta."}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">{form.name}</h1>
      {form.intro ? (
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {form.intro}
        </p>
      ) : null}

      <form
        action={`/api/forms/${encodeURIComponent(form.id)}/submit`}
        method="post"
        className="mt-5 space-y-4"
      >
        {/* Honeypot anti-spam (7.6): oculto; los humanos lo dejan vacío. */}
        <div aria-hidden className="hidden">
          <label>
            No rellenar
            <input name="_hp" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {form.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Este formulario aún no tiene campos.
          </p>
        ) : (
          form.fields.map((field) => <Field key={field.key} field={field} />)
        )}

        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          {form.submitLabel}
        </button>
      </form>

      <p className="text-muted-foreground mt-4 text-center text-xs">
        Enviado de forma segura · Nexo CRM
      </p>
    </Shell>
  );
}
