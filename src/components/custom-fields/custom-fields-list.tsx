import {
  customFieldTypeMeta,
  formatCustomValue,
  type CustomFieldDef,
} from "@/lib/custom-fields";

/** Filas de campos personalizados para mostrar en una ficha (estilo InfoRow). */
export function CustomFieldsList({
  defs,
  values,
}: {
  defs: CustomFieldDef[];
  values: Record<string, unknown> | null | undefined;
}) {
  if (defs.length === 0) return null;

  return (
    <>
      {defs.map((def) => {
        const Icon = customFieldTypeMeta[def.type].icon;
        const raw = values?.[def.key];
        const display = formatCustomValue(def.type, raw);
        return (
          <div key={def.id} className="flex items-start gap-3">
            <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">{def.label}</p>
              <div className="font-medium break-words">
                {def.type === "url" && raw ? (
                  <a
                    className="hover:text-foreground break-all underline-offset-2 hover:underline"
                    href={String(raw)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {display}
                  </a>
                ) : (
                  display
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
