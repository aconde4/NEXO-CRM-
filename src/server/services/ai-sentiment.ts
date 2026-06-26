import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import {
  messageSentimentSchema,
  type MessageSentimentValues,
} from "@/lib/validations/ai-sentiment";
import { completeAI } from "@/server/services/ai";
import { db } from "@/server/db";
import { type EmailSentiment, emailMessages } from "@/server/db/schema";

export type AnalyzeSentimentResult = {
  analyzed: number;
  failed: number;
  total: number;
  counts: Record<EmailSentiment, number>;
};

const MAX_MESSAGES = 10;

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageText(message: {
  bodyText: string | null;
  bodyHtml: string | null;
  snippet: string | null;
}): string {
  const text =
    message.bodyText?.trim() ||
    (message.bodyHtml ? htmlToText(message.bodyHtml) : "") ||
    message.snippet?.trim() ||
    "";
  return text.length > 4_000 ? `${text.slice(0, 3_999).trimEnd()}...` : text;
}

function systemPrompt(): string {
  return [
    "Eres un analista de comunicaciones comerciales B2B dentro de Nexo CRM.",
    "Clasifica el SENTIMIENTO de un email ENTRANTE de un contacto hacia nuestra empresa.",
    "sentiment: 'positive' (interes, acuerdo, agradecimiento), 'neutral' (informativo o ambiguo) o 'negative' (objecion, queja, rechazo, baja).",
    "intent: la intencion comercial principal (interest, question, objection, ready_to_buy, unsubscribe, complaint, other).",
    "Usa solo el contenido del email. No infieras lo que no esta escrito.",
    "Devuelve EXCLUSIVAMENTE JSON valido que cumpla el esquema indicado.",
  ].join("\n");
}

export async function analyzeThreadSentiment(
  ownerId: string,
  threadId: string,
  reanalyze = false,
): Promise<AnalyzeSentimentResult> {
  const where = and(
    eq(emailMessages.ownerId, ownerId),
    eq(emailMessages.threadId, threadId),
    eq(emailMessages.direction, "inbound"),
    reanalyze ? undefined : isNull(emailMessages.sentiment),
  );

  const messages = await db
    .select({
      id: emailMessages.id,
      subject: emailMessages.subject,
      bodyText: emailMessages.bodyText,
      bodyHtml: emailMessages.bodyHtml,
      snippet: emailMessages.snippet,
      fromName: emailMessages.fromName,
      fromEmail: emailMessages.fromEmail,
    })
    .from(emailMessages)
    .where(where)
    .orderBy(
      asc(
        sql`coalesce(${emailMessages.sentAt}, ${emailMessages.receivedAt}, ${emailMessages.createdAt})`,
      ),
    )
    .limit(MAX_MESSAGES);

  const counts: Record<EmailSentiment, number> = {
    negative: 0,
    neutral: 0,
    positive: 0,
  };
  let analyzed = 0;
  let failed = 0;

  for (const message of messages) {
    const text = messageText(message);
    if (!text) {
      failed += 1;
      continue;
    }
    try {
      const result = await completeAI<MessageSentimentValues>({
        feature: "email.sentiment",
        maxTokens: 120,
        messages: [
          {
            content: [
              message.subject ? `Asunto: ${message.subject}` : null,
              `De: ${message.fromName || message.fromEmail}`,
              "",
              text,
            ]
              .filter((line) => line !== null)
              .join("\n"),
            role: "user",
          },
        ],
        modelPreference: "fast",
        ownerId,
        schema: messageSentimentSchema,
        schemaName: "email_sentiment",
        system: systemPrompt(),
        temperature: 0,
      });

      if (!result.data) {
        failed += 1;
        continue;
      }

      await db
        .update(emailMessages)
        .set({ sentiment: result.data.sentiment, sentimentAt: new Date() })
        .where(
          and(
            eq(emailMessages.id, message.id),
            eq(emailMessages.ownerId, ownerId),
          ),
        );
      counts[result.data.sentiment] += 1;
      analyzed += 1;
    } catch (error) {
      failed += 1;
      console.error("No se pudo analizar el sentimiento", message.id, error);
    }
  }

  return { analyzed, counts, failed, total: messages.length };
}
