import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Avatar con iniciales. `square` para empresas, redondo para personas. */
export function EntityAvatar({
  name,
  square = false,
  className,
}: {
  name: string;
  square?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center text-xs font-semibold",
        square ? "rounded-md" : "rounded-full",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
