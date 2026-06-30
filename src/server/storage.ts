import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Acceso a Supabase Storage para los adjuntos (Fase 1.12). Solo en el servidor:
 * usa la `service_role` key. Si no está configurado, `isStorageConfigured()`
 * devuelve false y la UI lo indica en vez de romperse.
 */

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "attachments";

export const BACKUP_STORAGE_BUCKET =
  process.env.BACKUP_STORAGE_BUCKET?.trim() || "backups";

/** Deriva la URL del proyecto Supabase a partir de la cadena de conexión. */
function deriveSupabaseUrl(): string | null {
  const explicit = process.env.SUPABASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const conn = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
  if (!conn) return null;
  try {
    const url = new URL(conn);
    // Conexión directa: db.<ref>.supabase.co
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (hostMatch) return `https://${hostMatch[1]}.supabase.co`;
    // Pooler: usuario postgres.<ref>
    const userMatch = decodeURIComponent(url.username).match(
      /^postgres\.([a-z0-9]+)$/i,
    );
    if (userMatch) return `https://${userMatch[1]}.supabase.co`;
  } catch {
    return null;
  }
  return null;
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const supabaseUrl = deriveSupabaseUrl();

export function isStorageConfigured(): boolean {
  return Boolean(supabaseUrl && serviceKey);
}

let client: SupabaseClient | null = null;

function bucket(bucketName = STORAGE_BUCKET) {
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Supabase Storage no está configurado. Añade SUPABASE_SERVICE_ROLE_KEY (y SUPABASE_URL si hace falta) en .env.local.",
    );
  }
  client ??= createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(bucketName);
}

export async function uploadObject(
  path: string,
  body: ArrayBuffer | Uint8Array | Blob,
  contentType: string | undefined,
) {
  const { error } = await bucket().upload(path, body, {
    contentType: contentType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
}

export async function uploadBackupObject(
  path: string,
  body: ArrayBuffer | Uint8Array | Blob,
  contentType = "application/json; charset=utf-8",
) {
  const { error } = await bucket(BACKUP_STORAGE_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir la copia: ${error.message}`);
}

export async function createSignedDownloadUrl(
  path: string,
  fileName: string,
  expiresIn = 120,
): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, expiresIn, {
    download: fileName,
  });
  if (error || !data) {
    throw new Error(`No se pudo generar el enlace: ${error?.message ?? ""}`);
  }
  return data.signedUrl;
}

export async function createSignedBackupDownloadUrl(
  path: string,
  fileName: string,
  expiresIn = 120,
): Promise<string> {
  const { data, error } = await bucket(BACKUP_STORAGE_BUCKET).createSignedUrl(
    path,
    expiresIn,
    { download: fileName },
  );
  if (error || !data) {
    throw new Error(`No se pudo generar el enlace: ${error?.message ?? ""}`);
  }
  return data.signedUrl;
}

export async function removeObject(path: string) {
  const { error } = await bucket().remove([path]);
  if (error) throw new Error(`No se pudo eliminar el archivo: ${error.message}`);
}
