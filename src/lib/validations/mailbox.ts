import { z } from "zod";

export const mailboxSettingsSchema = z.object({
  dailyLimit: z.coerce.number().int().min(1).max(2000),
  signatureHtml: z.string().max(20_000).optional(),
});
export type MailboxSettingsValues = z.infer<typeof mailboxSettingsSchema>;
