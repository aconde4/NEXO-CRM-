import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Tarjeta con cabecera (icono + título + descripción) y cuerpo para una gráfica. */
export function ChartCard({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm">
          {Icon ? <Icon className="text-primary size-4" /> : null}
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-xs">{description}</CardDescription>
        ) : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}
