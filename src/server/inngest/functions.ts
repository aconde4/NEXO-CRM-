import { inngest } from "./client";

/**
 * Función de prueba para validar que Inngest está conectado (tarea 0.13).
 * Se dispara con el evento "demo/hello". En fases posteriores aquí vivirán
 * las funciones de secuencias y automatizaciones.
 */
export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "demo/hello" }] },
  async ({ event, step }) => {
    await step.sleep("esperar-un-momento", "1s");
    return { mensaje: `Hola ${event.data?.nombre ?? "mundo"} desde Inngest` };
  },
);

/** Todas las funciones registradas en el endpoint /api/inngest. */
export const functions = [helloWorld];
