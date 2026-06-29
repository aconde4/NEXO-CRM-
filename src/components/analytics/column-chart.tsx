import { cn } from "@/lib/utils";

export type ColumnBar = {
  key: string;
  /** Etiqueta del eje X. */
  label: string;
  /** Valor numérico que determina la altura de la barra. */
  value: number;
  /** Texto mostrado sobre la barra (p. ej. importe compacto). */
  valueText?: string;
  /** Tooltip con el detalle exacto. */
  title?: string;
  /** Resalta la barra (p. ej. el día/mes actual). */
  highlight?: boolean;
};

/**
 * Gráfica de columnas hecha a mano (CSS), sin dependencias ni cliente. Para
 * series temporales (previsión por mes, actividad por día, ganados por mes).
 */
export function ColumnChart({
  bars,
  height = 144,
  showValues = true,
  emptyText = "Sin datos en este periodo.",
  className,
}: {
  bars: ColumnBar[];
  height?: number;
  showValues?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const hasData = bars.some((b) => b.value > 0);

  if (bars.length === 0 || !hasData) {
    return (
      <p className="text-muted-foreground px-4 py-10 text-center text-sm">
        {emptyText}
      </p>
    );
  }

  return (
    <div className={cn("px-4 py-4", className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {bars.map((b) => {
          const pct = b.value > 0 ? Math.max(4, (b.value / max) * 100) : 0;
          return (
            <div
              key={b.key}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
              title={b.title ?? `${b.label}: ${b.valueText ?? b.value}`}
            >
              {showValues ? (
                <span className="text-muted-foreground text-center text-[10px] tabular-nums">
                  {b.value > 0 ? (b.valueText ?? b.value) : ""}
                </span>
              ) : null}
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all",
                  b.highlight
                    ? "bg-primary"
                    : "bg-primary/70 group-hover:bg-primary/90",
                )}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {bars.map((b) => (
          <div
            key={b.key}
            className={cn(
              "text-muted-foreground min-w-0 flex-1 truncate text-center text-[10px]",
              b.highlight && "text-foreground font-medium",
            )}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
