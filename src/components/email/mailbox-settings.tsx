"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { updateMailboxSettings } from "@/server/actions/mailbox";
import type { MailboxSettings as MailboxSettingsData } from "@/server/queries/gmail";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MailboxSettings({
  settings,
}: {
  settings: MailboxSettingsData | null;
}) {
  const router = useRouter();
  const [dailyLimit, setDailyLimit] = React.useState(
    String(settings?.dailyLimit ?? 50),
  );
  const [signature, setSignature] = React.useState(settings?.signatureHtml ?? "");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateMailboxSettings({
        dailyLimit: Number(dailyLimit) || 1,
        signatureHtml: signature,
      });
      toast.success("Ajustes del buzón guardados");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="text-muted-foreground size-4" />
          Correo (Gmail)
        </CardTitle>
        <CardDescription>
          Límite diario de envío (warm-up) y firma HTML del buzón.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!settings ? (
          <p className="text-muted-foreground text-sm">
            Conecta Gmail en{" "}
            <Link href="/inbox" className="text-primary hover:underline">
              Bandeja
            </Link>{" "}
            para configurar el límite de envío y la firma.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Enviados hoy:{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {settings.sentToday}
              </span>{" "}
              / {settings.dailyLimit}
            </p>

            <div className="grid gap-1.5 sm:max-w-xs">
              <Label>Límite diario de envío</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Empieza bajo (p. ej. 20-50) y súbelo poco a poco para calentar el
                buzón.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>Firma (HTML)</Label>
              <Textarea
                rows={5}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={
                  "<p>Un saludo,<br />Tu Nombre<br /><a href=\"https://…\">tuempresa.com</a></p>"
                }
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                Se añade al final de cada email enviado. El HTML se sanea al
                guardar.
              </p>
            </div>

            <Button onClick={save} disabled={busy}>
              {busy ? "Guardando…" : "Guardar ajustes"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
