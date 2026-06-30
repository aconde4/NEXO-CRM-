"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  type DocumentFormValues,
  type DocumentSignValues,
  documentFormSchema,
  documentIdSchema,
  documentSignSchema,
} from "@/lib/validations/document";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";

function revalidateDocuments() {
  revalidatePath("/documents");
}

export async function saveDocument(raw: DocumentFormValues) {
  const user = await requireUser();
  const data = documentFormSchema.parse(raw);
  const values = {
    body: data.body,
    dealId: data.dealId,
    signerEmail: data.signerEmail ? data.signerEmail : null,
    title: data.title,
  };

  if (data.id) {
    await db
      .update(documents)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(documents.id, data.id), eq(documents.ownerId, user.id)));
    revalidateDocuments();
    return { id: data.id };
  }

  const [created] = await db
    .insert(documents)
    .values({ ...values, ownerId: user.id })
    .returning({ id: documents.id });
  revalidateDocuments();
  return { id: created?.id };
}

/** Asigna un token público y marca el documento como enviado para firmar. */
export async function sendDocument(id: string) {
  const user = await requireUser();
  const docId = documentIdSchema.parse(id);
  const [doc] = await db
    .select({ status: documents.status, token: documents.token })
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.ownerId, user.id)))
    .limit(1);
  if (!doc) throw new Error("Documento no encontrado");

  const token = doc.token ?? randomUUID().replace(/-/g, "");
  await db
    .update(documents)
    .set({
      status: doc.status === "signed" ? "signed" : "sent",
      token,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, docId), eq(documents.ownerId, user.id)));
  revalidateDocuments();
  return { token };
}

export async function deleteDocument(id: string) {
  const user = await requireUser();
  const docId = documentIdSchema.parse(id);
  await db
    .delete(documents)
    .where(and(eq(documents.id, docId), eq(documents.ownerId, user.id)));
  revalidateDocuments();
  return { id: docId };
}

/** Firma pública (sin sesión): el firmante escribe su nombre en /sign/[token]. */
export async function signDocument(raw: DocumentSignValues) {
  const data = documentSignSchema.parse(raw);
  const [doc] = await db
    .select({ status: documents.status })
    .from(documents)
    .where(eq(documents.token, data.token))
    .limit(1);
  if (!doc) throw new Error("Documento no encontrado.");
  if (doc.status === "signed") {
    throw new Error("Este documento ya está firmado.");
  }
  if (doc.status !== "sent") {
    throw new Error("Este documento no está disponible para firmar.");
  }

  await db
    .update(documents)
    .set({
      signedAt: new Date(),
      signerName: data.signerName,
      status: "signed",
      updatedAt: new Date(),
    })
    .where(eq(documents.token, data.token));
  revalidatePath(`/sign/${data.token}`);
  return { ok: true as const };
}
