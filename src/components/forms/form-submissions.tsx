import Link from "next/link";
import { User } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { FormFieldDef } from "@/server/db/schema/forms";
import type { FormSubmissionItem } from "@/server/queries/forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function labelFor(fields: FormFieldDef[], key: string): string {
  return fields.find((f) => f.key === key)?.label ?? key;
}

export function FormSubmissions({
  submissions,
  fields,
}: {
  submissions: FormSubmissionItem[];
  fields: FormFieldDef[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Envíos recientes</CardTitle>
        <CardDescription>
          Cada vez que alguien envía este formulario, su respuesta aparece aquí
          (y como lead en la bandeja).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aún no hay envíos. Publica el formulario y compártelo para empezar a
            recibir respuestas.
          </p>
        ) : (
          <div className="divide-y">
            {submissions.map((sub) => {
              const entries = Object.entries(sub.data).filter(
                ([, value]) => value !== "" && value != null,
              );
              return (
                <div key={sub.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {sub.person ? (
                      <Link
                        href={`/contacts/${sub.person.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                      >
                        <User className="text-muted-foreground size-3.5" />
                        {sub.person.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Sin contacto
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(sub.createdAt)}
                    </span>
                  </div>

                  {entries.length > 0 ? (
                    <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      {entries.map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-xs">
                          <dt className="text-muted-foreground shrink-0">
                            {labelFor(fields, key)}:
                          </dt>
                          <dd className="min-w-0 truncate">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
