import { Check, Sparkles, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
  features,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Texto de la fase, p. ej. "Fase 1". */
  phase: string;
  /** Lista de funciones que tendrá esta sección. */
  features: string[];
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <div className="bg-card relative w-full max-w-lg overflow-hidden rounded-xl border p-8 shadow-sm">
        <div
          aria-hidden
          className="from-primary/10 pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-gradient-to-br to-transparent blur-2xl"
        />
        <div className="relative">
          <div className="bg-primary/10 text-primary mb-5 flex size-12 items-center justify-center rounded-xl">
            <Icon className="size-6" />
          </div>

          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3" />
              {phase}
            </Badge>
          </div>

          <p className="text-muted-foreground text-sm">{description}</p>

          <div className="mt-6 space-y-2.5">
            <p className="text-xs font-medium tracking-wide uppercase opacity-70">
              Lo que incluirá
            </p>
            <ul className="space-y-2">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <span className="bg-success/15 text-success mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
