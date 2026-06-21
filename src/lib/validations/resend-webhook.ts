import { z } from "zod";

export const resendEmailEventTypes = [
  "email.sent",
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.failed",
  "email.delivery_delayed",
] as const;

export type ResendEmailEventType = (typeof resendEmailEventTypes)[number];

const validDateString = (value: string) => !Number.isNaN(Date.parse(value));

const optionalString = z.string().trim().min(1).optional();

const resendTagsSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .transform((tags) => {
    if (!tags) return {};
    return Object.fromEntries(
      Object.entries(tags).map(([key, value]) => [key, String(value)]),
    );
  });

export const resendWebhookEventSchema = z.object({
  created_at: z.string().refine(validDateString),
  data: z
    .object({
      bounce: z
        .object({
          message: optionalString,
          subType: optionalString,
          type: optionalString,
        })
        .passthrough()
        .optional(),
      broadcast_id: optionalString,
      click: z
        .object({
          ipAddress: optionalString,
          link: optionalString,
          timestamp: z.string().refine(validDateString).optional(),
          userAgent: optionalString,
        })
        .passthrough()
        .optional(),
      created_at: z.string().refine(validDateString).optional(),
      email_id: z.string().trim().min(1),
      from: optionalString,
      subject: optionalString,
      tags: resendTagsSchema,
      template_id: optionalString,
      to: z.array(z.string().trim().min(1)).default([]),
    })
    .passthrough(),
  type: z.string().trim().min(1),
});

export type ResendWebhookEvent = z.infer<typeof resendWebhookEventSchema>;

export function isResendEmailEventType(
  value: string,
): value is ResendEmailEventType {
  return resendEmailEventTypes.includes(value as ResendEmailEventType);
}

export function parseResendWebhookEvent(payload: string): ResendWebhookEvent {
  return resendWebhookEventSchema.parse(JSON.parse(payload) as unknown);
}
