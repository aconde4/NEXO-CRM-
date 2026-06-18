"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function subscribeMounted() {
  return () => {};
}

function useMounted() {
  return React.useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cambiar tema"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          />
        }
      >
        {/* Evita parpadeo de hidratación: render neutro hasta montar */}
        {mounted && isDark ? (
          <Moon className="size-[1.15rem]" />
        ) : (
          <Sun className="size-[1.15rem]" />
        )}
      </TooltipTrigger>
      <TooltipContent>{isDark ? "Modo claro" : "Modo oscuro"}</TooltipContent>
    </Tooltip>
  );
}
