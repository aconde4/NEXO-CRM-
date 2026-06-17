import { cn } from "@/lib/utils";

export type LabelChip = { id: string; name: string; color: string };

export function LabelChips({
  labels,
  className,
}: {
  labels: LabelChip[];
  className?: string;
}) {
  if (labels.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {labels.map((label) => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none font-medium"
          style={{
            color: label.color,
            borderColor: `${label.color}55`,
            backgroundColor: `${label.color}14`,
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: label.color }}
          />
          {label.name}
        </span>
      ))}
    </span>
  );
}
