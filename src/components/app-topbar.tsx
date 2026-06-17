"use client";

import * as React from "react";
import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { findNavItem } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandMenu } from "@/components/command-menu";

export function AppTopbar() {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const title = current?.title ?? "Nexo CRM";

  const [cmdOpen, setCmdOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-sm">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <h1 className="text-sm font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors sm:flex"
          aria-label="Buscar"
        >
          <Search className="size-4" />
          <span>Buscar…</span>
          <kbd className="bg-muted text-muted-foreground pointer-events-none ml-2 hidden rounded border px-1.5 font-mono text-[10px] font-medium md:inline-block">
            ⌘K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Buscar"
          onClick={() => setCmdOpen(true)}
          className="text-muted-foreground sm:hidden"
        >
          <Search className="size-[1.15rem]" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificaciones"
          className="text-muted-foreground"
        >
          <Bell className="size-[1.15rem]" />
        </Button>

        <ThemeToggle />
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </header>
  );
}
