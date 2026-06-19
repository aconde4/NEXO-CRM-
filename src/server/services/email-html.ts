import "server-only";

import sanitizeHtml from "sanitize-html";

const EMAIL_ALLOWED_TAGS = [
  "p",
  "span",
  "br",
  "a",
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

type SanitizeEmailHtmlOptions = {
  transformHref?: (href: string) => string;
};

function normalizeEmailHref(value: string | undefined): string | null {
  const href = value?.trim();
  if (!href) return null;

  try {
    const url = new URL(href);
    if (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "mailto:" ||
      url.protocol === "tel:"
    ) {
      return href;
    }
  } catch {
    return null;
  }

  return null;
}

export function sanitizeEmailHtml(
  html: string,
  options: SanitizeEmailHtmlOptions = {},
): string {
  return sanitizeHtml(html, {
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedTags: EMAIL_ALLOWED_TAGS,
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const href = normalizeEmailHref(attribs.href);
        if (!href) return { attribs: {}, tagName: "span" };
        return {
          attribs: {
            href: options.transformHref?.(href) ?? href,
            rel: "noopener noreferrer",
            target: "_blank",
          },
          tagName: "a",
        };
      },
    },
  });
}
