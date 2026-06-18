"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";

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
          <CommandItem
            value="nueva actividad tarea crear"
            onSelect={() => go("/activities")}
          >
            <Plus />
            Nueva actividad
          </CommandItem>
          <CommandItem
            value="nuevo negocio oportunidad crear"
            onSelect={() => go("/deals")}
          >
            <Plus />
            Nuevo negocio
          </CommandItem>
          <CommandItem
            value="importar contactos csv excel"
            onSelect={() => go("/contacts/import")}
          >
            <Upload />
            Importar contactos
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
