import "server-only";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
} from "@react-email/components";
import { render } from "@react-email/render";

import type { CampaignEmailBlock } from "@/lib/campaign-blocks";
import { renderMergeTags, textToHtml } from "@/lib/email/merge-tags";
import { sanitizeEmailHtml } from "@/server/services/email-html";

type CampaignRenderMode = "template" | "personalized";

export type CampaignEmailRenderInput = {
  subject: string;
  preheader?: string | null;
  blocks: CampaignEmailBlock[];
  mergeContext?: Record<string, string>;
  mode?: CampaignRenderMode;
};

export type RenderedCampaignEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

const bodyStyle = {
  margin: 0,
  backgroundColor: "#f6f8fb",
  color: "#111827",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const containerStyle = {
  margin: "0 auto",
  maxWidth: "640px",
  padding: "32px 20px",
};

const panelStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "32px",
};

const headingStyle = {
  color: "#111827",
  fontSize: "26px",
  fontWeight: "700",
  lineHeight: "1.25",
  margin: "0 0 18px",
};

const richTextStyle = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.65",
};

const buttonStyle = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 18px",
  textDecoration: "none",
};

const dividerStyle = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

function applyMerge(
  value: string,
  input: CampaignEmailRenderInput,
  options: { escapeValues?: boolean } = {},
): string {
  if (input.mode !== "personalized") return value;
  return renderMergeTags(value, input.mergeContext ?? {}, options);
}

function safeHref(value: string): string | null {
  const href = value.trim();
  try {
    const url = new URL(href);
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
      return href;
    }
  } catch {
    return null;
  }
  return null;
}

function blockText(
  block: CampaignEmailBlock,
  input: CampaignEmailRenderInput,
): string {
  switch (block.type) {
    case "richText":
      return applyMerge(block.text, input);
    case "heading":
      return applyMerge(block.text, input);
    case "button":
      return applyMerge(block.label, input);
    case "divider":
      return "";
    default:
      return "";
  }
}

function CampaignEmail(input: CampaignEmailRenderInput) {
  const preheader = applyMerge(input.preheader ?? "", input);

  return (
    <Html>
      <Head />
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={panelStyle}>
            {input.blocks.map((block) => {
              if (block.type === "heading") {
                return (
                  <Heading key={block.id} as="h1" style={headingStyle}>
                    {applyMerge(block.text, input)}
                  </Heading>
                );
              }

              if (block.type === "richText") {
                const sourceHtml = block.html.trim()
                  ? block.html
                  : textToHtml(block.text);
                const html = sanitizeEmailHtml(
                  applyMerge(sourceHtml, input, { escapeValues: true }),
                );
                return (
                  <Section key={block.id}>
                    <div
                      style={richTextStyle}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </Section>
                );
              }

              if (block.type === "button") {
                const href = safeHref(applyMerge(block.href, input));
                if (!href) return null;
                return (
                  <Section key={block.id} style={{ margin: "24px 0" }}>
                    <Button href={href} style={buttonStyle}>
                      {applyMerge(block.label, input)}
                    </Button>
                  </Section>
                );
              }

              if (block.type === "divider") {
                return <Hr key={block.id} style={dividerStyle} />;
              }

              return null;
            })}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderCampaignEmail(
  input: CampaignEmailRenderInput,
): Promise<RenderedCampaignEmail> {
  const email = <CampaignEmail {...input} />;
  const [html, text] = await Promise.all([
    render(email, { pretty: true }),
    render(email, { plainText: true }),
  ]);

  return {
    subject: applyMerge(input.subject, input),
    preheader: applyMerge(input.preheader ?? "", input),
    html,
    text:
      text.trim() ||
      input.blocks
        .map((block) => blockText(block, input))
        .filter(Boolean)
        .join("\n\n"),
  };
}
