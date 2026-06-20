export type CampaignEmailBlock =
  | {
      id: string;
      type: "richText";
      html: string;
      text: string;
    }
  | {
      id: string;
      type: "heading";
      text: string;
    }
  | {
      id: string;
      type: "button";
      label: string;
      href: string;
    }
  | {
      id: string;
      type: "divider";
    };

export type CampaignEmailBlockType = CampaignEmailBlock["type"];

export const CAMPAIGN_BLOCK_LABELS: Record<CampaignEmailBlockType, string> = {
  richText: "Texto",
  heading: "Título",
  button: "Botón",
  divider: "Separador",
};

export function htmlHasContent(value: string): boolean {
  return value.replace(/<[^>]*>/g, "").trim().length > 0;
}

export function isSafeCampaignHref(value: string): boolean {
  const href = value.trim();
  if (!href) return false;

  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function makeBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createCampaignBlock(
  type: CampaignEmailBlockType = "richText",
): CampaignEmailBlock {
  const id = makeBlockId();
  switch (type) {
    case "heading":
      return { id, type, text: "" };
    case "button":
      return { id, type, label: "Ver más", href: "https://" };
    case "divider":
      return { id, type };
    case "richText":
    default:
      return { id, type: "richText", html: "", text: "" };
  }
}

export function createDefaultCampaignBlocks(): CampaignEmailBlock[] {
  return [createCampaignBlock("richText")];
}

export function campaignBlocksHaveContent(
  blocks: CampaignEmailBlock[],
): boolean {
  return blocks.some((block) => {
    switch (block.type) {
      case "richText":
        return Boolean(block.text.trim() || htmlHasContent(block.html));
      case "heading":
        return Boolean(block.text.trim());
      case "button":
        return Boolean(block.label.trim() && isSafeCampaignHref(block.href));
      case "divider":
        return false;
      default:
        return false;
    }
  });
}
