"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { navGroups, settingsNavItem } from "@/lib/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar"
      description="Navega o ejecuta una acción"
    >
      <CommandInput placeholder="Buscar páginas y acciones…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Acciones">
          <CommandItem value="nuevo contacto crear" onSelect={() => go("/contacts")}>
            <Plus />
            Nuevo contacto
          </CommandItem>
          <CommandItem
            value="nueva empresa crear"
            onSelect={() => go("/organizations")}
          >
            <Plus />
            Nueva empresa
          </CommandItem>
        </CommandGroup>

        {navGroups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.title} ${group.label}`}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandGroup heading="Otros">
          <CommandItem
            value={settingsNavItem.title}
            onSelect={() => go(settingsNavItem.href)}
          >
            <settingsNavItem.icon />
            {settingsNavItem.title}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
