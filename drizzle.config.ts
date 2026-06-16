import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Carga variables desde .env.local para los comandos de drizzle-kit (migraciones).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // DIRECT_URL = conexión directa (sin pooler), recomendada para migraciones.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
