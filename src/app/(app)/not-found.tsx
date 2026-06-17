import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex flex-col items-center text-center">
        <div className="bg-primary/10 text-primary mb-5 flex size-14 items-center justify-center rounded-2xl">
          <Compass className="size-7" />
        </div>
        <p className="text-primary text-sm font-semibold">Error 404</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          No encontramos esta página
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          El registro puede haberse eliminado o el enlace no es correcto.
        </p>
        <Button className="mt-6" render={<Link href="/dashboard" />}>
          Volver al panel
        </Button>
      </div>
    </div>
  );
}
