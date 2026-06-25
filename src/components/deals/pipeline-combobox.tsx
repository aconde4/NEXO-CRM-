"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import { DEALS_PIPELINE_COOKIE } from "@/lib/deals-pipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type PipelineComboboxOption = { id: string; name: string };

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

/** Guarda el embudo elegido para que /deals lo recuerde sin parámetro en la URL. */
export function rememberDealsPipeline(id: string) {
  document.cookie = `${DEALS_PIPELINE_COOKIE}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Selector de embudo tipo combobox con buscador (6.4f). Sustituye al `<select>`
 * nativo para que con muchos embudos se pueda filtrar por nombre. Recuerda el
 * último embudo abierto en una cookie que lee la página en servidor.
 */
export function PipelineCombobox({
  pipelines,
  value,
  onSelect,
  className,
}: {
  pipelines: PipelineComboboxOption[];
  value: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const active = pipelines.find((p) => p.id === value);

  function choose(id: string) {
    setOpen(false);
    if (id === value) return;
    rememberDealsPipeline(id);
    onSelect(id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-expanded={open}
            className={cn(
              "h-9 w-[13rem] shrink-0 justify-between gap-2 font-normal",
              className,
            )}
          />
        }
      >
        <span className="truncate">
          {active?.name ?? "Selecciona un embudo"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar embudo…" />
          <CommandList>
            <CommandEmpty>Sin embudos.</CommandEmpty>
            {pipelines.map((p) => (
              <CommandItem
                key={p.id}
                value={p.name}
                data-checked={p.id === value}
                onSelect={() => choose(p.id)}
              >
                <span className="truncate">{p.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
