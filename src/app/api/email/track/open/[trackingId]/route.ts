import {
  recordEmailOpen,
  TRACKING_NO_STORE_HEADERS,
  TRACKING_PIXEL,
} from "@/server/services/email-tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> },
) {
  const { trackingId } = await params;

  if (trackingId) {
    try {
      await recordEmailOpen(trackingId, request);
    } catch (error) {
      console.error("No se pudo registrar la apertura de email", error);
    }
  }

  return new Response(TRACKING_PIXEL, {
    headers: {
      ...TRACKING_NO_STORE_HEADERS,
      "Content-Length": String(TRACKING_PIXEL.byteLength),
      "Content-Type": "image/gif",
    },
  });
}
