"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import {
  mailboxSettingsSchema,
  type MailboxSettingsValues,
} from "@/lib/validations/mailbox";
import { db } from "@/server/db";
import { mailboxes } from "@/server/db/schema";
import { sanitizeEmailHtml } from "@/server/services/email-html";

export async function updateMailboxSettings(raw: MailboxSettingsValues) {
  const user = await requireUser();
  const data = mailboxSettingsSchema.parse(raw);

  const signature = data.signatureHtml?.trim()
    ? sanitizeEmailHtml(data.signatureHtml)
    : null;

  const result = await db
    .update(mailboxes)
    .set({ dailyLimit: data.dailyLimit, signatureHtml: signature })
    .where(
      and(eq(mailboxes.ownerId, user.id), eq(mailboxes.provider, "gmail")),
    )
    .returning({ id: mailboxes.id });

  if (result.length === 0) {
    throw new Error(
      "Aún no hay buzón Gmail. Conéctalo desde Bandeja antes de configurarlo.",
    );
  }

  revalidatePath("/inbox");
  revalidatePath("/settings");
  return { id: result[0]?.id };
}
