import {
  recordEmailClick,
  TRACKING_NO_STORE_HEADERS,
  verifyTrackedClickUrl,
} from "@/server/services/email-tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trackingId: string }> },
) {
  const { trackingId } = await params;
  const requestUrl = new URL(request.url);
  const targetUrl = verifyTrackedClickUrl(
    trackingId,
    requestUrl.searchParams.get("u"),
    requestUrl.searchParams.get("s"),
  );

  if (!targetUrl) {
    return new Response("Enlace no valido", {
      headers: TRACKING_NO_STORE_HEADERS,
      status: 400,
    });
  }

  try {
    await recordEmailClick({ request, targetUrl, trackingId });
  } catch (error) {
    console.error("No se pudo registrar el clic de email", error);
  }

  return new Response(null, {
    headers: {
      ...TRACKING_NO_STORE_HEADERS,
      Location: targetUrl,
    },
    status: 302,
  });
}
