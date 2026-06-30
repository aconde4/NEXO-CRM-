"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { signDocument } from "@/server/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Escribe tu nombre completo.");
      return;
    }
    setBusy(true);
    try {
      await signDocument({ signerName: name, token });
      toast.success("Documento firmado");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo firmar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label>Firma escribiendo tu nombre completo</Label>
      <Input
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nombre y apellidos"
      />
      <p className="text-muted-foreground text-xs">
        Al firmar confirmas que aceptas el contenido de este documento.
      </p>
      <Button type="submit" disabled={busy} className="mt-1 w-fit">
        <PenLine />
        {busy ? "Firmando…" : "Firmar documento"}
      </Button>
    </form>
  );
}
