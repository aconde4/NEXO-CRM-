import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatDateTime } from "@/lib/format";
import { getDocumentByToken } from "@/server/queries/documents";
import { SignForm } from "@/components/documents/sign-form";

export const metadata: Metadata = { title: "Firmar documento" };

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getDocumentByToken(token);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="bg-card rounded-xl border p-6 sm:p-8">
        <p className="text-muted-foreground text-xs">
          {doc.ownerName ? `Enviado por ${doc.ownerName}` : "Documento para firmar"}
        </p>
        <h1 className="mt-1 text-xl font-semibold">{doc.title}</h1>
        <div className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
          {doc.body || "—"}
        </div>

        <div className="mt-6 border-t pt-6">
          {doc.status === "signed" ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Firmado por <strong>{doc.signerName}</strong>
              {doc.signedAt ? ` el ${formatDateTime(doc.signedAt)}` : ""}.
            </p>
          ) : doc.status === "sent" ? (
            <SignForm token={token} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Este documento todavía no está disponible para firmar.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
