"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import { sendEmailSchema, type SendEmailValues } from "@/lib/validations/email";
import { sanitizeEmailHtml } from "@/server/services/email-html";
import { sendGmailEmail } from "@/server/services/gmail";
import { syncGmailMailbox } from "@/server/services/gmail-sync";

function cleanOptional(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function revalidateEmailSurfaces(
  data: SendEmailValues,
  resultThreadId: string,
) {
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath(`/inbox/${resultThreadId}`);

  const personId = cleanOptional(data.personId);
  const orgId = cleanOptional(data.orgId);
  const dealId = cleanOptional(data.dealId);
  if (personId) {
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${personId}`);
  }
  if (orgId) {
    revalidatePath("/organizations");
    revalidatePath(`/organizations/${orgId}`);
  }
  if (dealId) {
    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
  }
}

export async function sendEmail(raw: SendEmailValues) {
  const user = await requireUser();
  const data = sendEmailSchema.parse(raw);
  const safeData = {
    ...data,
    bodyHtml: data.bodyHtml ? sanitizeEmailHtml(data.bodyHtml) : data.bodyHtml,
  };
  const result = await sendGmailEmail(user.id, safeData);
  revalidateEmailSurfaces(safeData, result.threadId);
  return result;
}

export async function syncGmailInboxNow() {
  const user = await requireUser();
  const result = await syncGmailMailbox(user.id);
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  return result;
}
