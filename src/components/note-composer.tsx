"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createNote } from "@/server/actions/contacts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteComposer({
  personId,
  orgId,
  dealId,
}: {
  personId?: string;
  orgId?: string;
  dealId?: string;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await createNote({ body, personId, orgId, dealId });
      setBody("");
      toast.success("Nota añadida");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la nota",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escribe una nota sobre esta ficha…"
        rows={3}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={saving || !body.trim()}>
          {saving ? "Guardando…" : "Añadir nota"}
        </Button>
      </div>
    </div>
  );
}
