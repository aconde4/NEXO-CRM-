"use client";

import { Braces } from "lucide-react";

import type { MergeTag } from "@/lib/email/merge-tags";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MergeTagMenu({
  catalog,
  onSelect,
  disabled,
  label = "Insertar variable",
}: {
  catalog: MergeTag[];
  onSelect: (tag: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || catalog.length === 0}
          />
        }
      >
        <Braces className="size-4" />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-80 min-w-72 overflow-y-auto"
      >
        {catalog.map((item) => (
          <DropdownMenuItem key={item.tag} onClick={() => onSelect(item.tag)}>
            <span className="text-muted-foreground font-mono text-xs">
              {`{{${item.tag}}}`}
            </span>
            <span className="ml-auto truncate pl-4 text-right text-xs">
              {item.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
