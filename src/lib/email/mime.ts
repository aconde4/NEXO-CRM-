export type EmailAddressInput = {
  email: string;
  name?: string | null;
};

export type MimeMessageInput = {
  from: EmailAddressInput;
  to: EmailAddressInput[];
  cc?: EmailAddressInput[];
  bcc?: EmailAddressInput[];
  replyTo?: EmailAddressInput[];
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  messageId: string;
  date?: Date;
  inReplyTo?: string | null;
  references?: string | null;
};

const CRLF = "\r\n";

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeMimeWord(value: string): string {
  const clean = sanitizeHeaderValue(value);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function encodePhrase(value: string): string {
  const clean = sanitizeHeaderValue(value);
  if (!clean) return "";
  if (/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~ -]+$/.test(clean)) {
    return `"${clean.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return encodeMimeWord(clean);
}

function formatAddress(address: EmailAddressInput): string {
  const email = sanitizeHeaderValue(address.email);
  const name = sanitizeHeaderValue(address.name ?? "");
  return name ? `${encodePhrase(name)} <${email}>` : email;
}

function formatAddressList(addresses: EmailAddressInput[] | undefined): string {
  return (addresses ?? []).map(formatAddress).join(", ");
}

function foldBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join(CRLF) ?? "";
}

function encodeBodyPart(value: string): string {
  return foldBase64(Buffer.from(value, "utf8").toString("base64"));
}

function boundary(): string {
  return `nexo_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
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

export function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildMimeMessage(input: MimeMessageInput): string {
  const bodyHtml = input.bodyHtml?.trim() || null;
  const bodyText =
    input.bodyText?.trim() || (bodyHtml ? htmlToText(bodyHtml) : null);
  if (!bodyText && !bodyHtml) {
    throw new Error("El email necesita cuerpo en texto o HTML");
  }

  const headers = [
    ["MIME-Version", "1.0"],
    ["Date", (input.date ?? new Date()).toUTCString()],
    ["Message-ID", sanitizeHeaderValue(input.messageId)],
    ["From", formatAddress(input.from)],
    ["To", formatAddressList(input.to)],
    ["Subject", encodeMimeWord(input.subject)],
  ];

  const cc = formatAddressList(input.cc);
  const bcc = formatAddressList(input.bcc);
  const replyTo = formatAddressList(input.replyTo);
  if (cc) headers.push(["Cc", cc]);
  if (bcc) headers.push(["Bcc", bcc]);
  if (replyTo) headers.push(["Reply-To", replyTo]);
  if (input.inReplyTo)
    headers.push(["In-Reply-To", sanitizeHeaderValue(input.inReplyTo)]);
  if (input.references)
    headers.push(["References", sanitizeHeaderValue(input.references)]);

  if (bodyHtml) {
    const altBoundary = boundary();
    headers.push([
      "Content-Type",
      `multipart/alternative; boundary="${altBoundary}"`,
    ]);
    const parts = [
      `--${altBoundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodeBodyPart(bodyText ?? ""),
      `--${altBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodeBodyPart(bodyHtml),
      `--${altBoundary}--`,
      "",
    ];
    return `${headers.map(([k, v]) => `${k}: ${v}`).join(CRLF)}${CRLF}${CRLF}${parts.join(CRLF)}`;
  }

  headers.push(["Content-Type", "text/plain; charset=UTF-8"]);
  headers.push(["Content-Transfer-Encoding", "base64"]);
  return `${headers.map(([k, v]) => `${k}: ${v}`).join(CRLF)}${CRLF}${CRLF}${encodeBodyPart(bodyText ?? "")}`;
}

export function buildGmailRawMessage(input: MimeMessageInput): string {
  return toBase64Url(buildMimeMessage(input));
}
