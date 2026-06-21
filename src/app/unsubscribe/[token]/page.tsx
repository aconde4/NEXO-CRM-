import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import {
  type CampaignUnsubscribePreview,
  getCampaignUnsubscribePreview,
} from "@/server/services/campaign-unsubscribe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Baja de comunicaciones",
};

function Panel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <section className="bg-background w-full max-w-lg rounded-lg border p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Nexo CRM</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="mt-5 space-y-4">{children}</div>
      </section>
    </main>
  );
}

function InvalidState({
  preview,
}: {
  preview: Extract<CampaignUnsubscribePreview, { ok: false }>;
}) {
  const message =
    preview.reason === "not_found"
      ? "No hemos encontrado esta suscripción. Puede que el enlace ya no exista."
      : "El enlace de baja no es válido.";
  return (
    <Panel title="No se pudo gestionar la baja">
      <p className="text-muted-foreground text-sm leading-6">{message}</p>
    </Panel>
  );
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getCampaignUnsubscribePreview(token);

  if (!preview.ok) return <InvalidState preview={preview} />;

  if (preview.isUnsubscribed) {
    return (
      <Panel title="Ya estás dado de baja">
        <p className="text-muted-foreground text-sm leading-6">
          {preview.email} ya no recibirá campañas de marketing de esta cuenta.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Confirmar baja">
      <div className="space-y-2">
        <p className="text-sm leading-6">
          Vas a dejar de recibir campañas de marketing en{" "}
          <span className="font-medium">{preview.email}</span>.
        </p>
        <p className="text-muted-foreground text-sm leading-6">
          Campaña: {preview.campaignName || preview.campaignSubject}
        </p>
      </div>
      <form
        action={`/api/campaigns/unsubscribe/${encodeURIComponent(token)}`}
        method="post"
      >
        <input type="hidden" name="source" value="page" />
        <Button type="submit" className="w-full">
          Darme de baja
        </Button>
      </form>
      <p className="text-muted-foreground text-xs leading-5">
        Esta acción solo afecta a campañas de marketing. Los correos 1:1
        necesarios para una conversación comercial no se envían desde este
        sistema de campañas.
      </p>
    </Panel>
  );
}
