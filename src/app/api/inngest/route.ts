import { serve } from "inngest/next";

import { inngest } from "@/server/inngest/client";
import { functions } from "@/server/inngest/functions";

// Endpoint que Inngest usa para descubrir y ejecutar las funciones.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
