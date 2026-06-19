import "server-only";

import sanitizeHtml from "sanitize-html";

const EMAIL_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "ul",
  "ol",
  "li",
  "blockquote",
];

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedAttributes: {},
    allowedTags: EMAIL_ALLOWED_TAGS,
    disallowedTagsMode: "discard",
  });
}
