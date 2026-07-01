# 05 · Seguridad y Rendimiento (revisión)

Revisión del plan y del estado actual para que el CRM sea **seguro, rápido y de
calidad profesional**. Pensado para **pocos usuarios** (uso personal/equipo
pequeño): se prioriza solidez y fluidez sobre escala masiva, sin sobre-ingeniería.

## 1. Veredicto

El stack y el plan son **adecuados y seguros** para este caso. Arquitectura
serverless (Vercel + Supabase + Inngest) = sin servidores que mantener, coste casi
cero y suficiente rendimiento de sobra para pocos usuarios. No hay que cambiar de
rumbo; sí incorporamos las buenas prácticas de abajo a medida que construimos.

**Revisión final 10.7 (2026-07-01):** no se han detectado bloqueantes de seguridad o
rendimiento para cerrar la Fase 10. Se corrigieron cabeceras defensivas, resolución de
dependencias vulnerable (`postcss`), inicialización de base de datos más segura para
herramientas/builds, y se añadió suite e2e Playwright para los flujos críticos.

## 2. Seguridad

### Ya en marcha ✅
- **Acceso a BD solo desde el servidor.** La cadena de conexión vive en
  `.env.local`/variables de Vercel y **nunca llega al navegador**. No exponemos la
  `anon key` de Supabase ni consultamos la BD desde el cliente.
- **Autenticación robusta:** Auth.js v5, sesiones en base de datos (revocables),
  PKCE en el OAuth, cookies `httpOnly`/`sameSite=lax` (y `secure` en producción).
- **Allowlist monousuario:** solo `ALLOWED_EMAILS` puede entrar (callback `signIn`).
- **Protección de rutas en dos capas:** `proxy.ts` (rápido, por cookie) + validación
  real con `auth()` en el layout protegido.
- **SQL sin inyección:** Drizzle parametriza todas las consultas.
- **Secretos fuera del repo:** `.gitignore` cubre `.env*`; verificado en cada commit.
- **Cabeceras defensivas globales:** `next.config.ts` añade HSTS, `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`.
- **Dependencias auditadas:** `pnpm audit --prod` queda limpio. Se fuerza `postcss@8.5.15`
  con override de pnpm para corregir GHSA-qx2v-qp2m-jg93 en resoluciones transitivas.
- **Endpoints públicos revisados:** formularios públicos con honeypot/rate limit,
  baja/unsubscribe firmada, tracking sin cache y webhook Resend firmado. Inngest queda
  en su handler oficial.

### A incorporar 🔜
- [x] **Validación Zod en TODA mutación** (server actions) — entrada nunca confiable.
- [x] **Autorización por propietario:** cada consulta filtra por `owner_id` (aunque
      ahora seas solo tú, deja el patrón listo para multiusuario).
- [x] **Cabeceras de seguridad** en `next.config.ts` (HSTS, X-Content-Type-Options,
      Referrer-Policy, X-Frame-Options) — se añaden al desplegar.
- [x] **Rate limiting** en endpoints públicos (formularios web de la Fase 7) +
      honeypot anti-spam.
- [ ] **RLS en Supabase** como defensa en profundidad (baja prioridad: el acceso ya
      es solo servidor; se activa si algún día hubiera acceso directo desde cliente).
- [x] **RGPD** (Fase 4): consentimiento, baja, supresión, export y borrado de datos.
- [x] **Webhooks firmados** (Resend) — verificar firma siempre. Inngest usa `serve`
      oficial con su configuración.
- [ ] **Rotar credenciales** compartidas en chat (contraseña Supabase + secreto
      Google) una vez todo funcione. ⚠️ Pendiente.
- [x] **Backups:** Supabase hace copias automáticas; añadimos export propio (Fase 10.4).

## 3. Rendimiento y fluidez

### Base de datos
- [x] **Pooling correcto:** la app usa el *Transaction pooler* (PgBouncer) con
      `prepare: false`; las migraciones, el *Session pooler*. Ideal para serverless.
- [x] **Cliente DB build-safe:** `src/server/db/index.ts` inicializa Postgres/Drizzle de
      forma lazy para no abrir conexión al importar módulos en herramientas o builds.
- [x] **Índices** desde la Fase 1: en claves foráneas (`org_id`, `owner_id`,
      `deal_id`…) y en columnas de búsqueda/orden (email, nombre, `created_at`,
      `stage_id`). Con índices, las tablas van fluidas aunque crezcan los datos.
- [x] **Sin N+1 crítico:** las pantallas principales usan consultas agregadas/joins y
      cargas por lote; las acciones en lote deduplican IDs antes de mutar.
- [x] **Paginación/límites:** los listados principales tienen límites razonables
      (p. ej. negocios/listas/reportes) para el uso personal/pequeño equipo.

### Front-end / percepción de velocidad
- [x] **React Server Components + Server Actions:** menos JS al cliente, datos en el
      servidor, navegación rápida.
- [ ] **UI optimista** en acciones frecuentes (crear/editar/mover) → respuesta
      instantánea, se confirma en segundo plano.
- [ ] **Estados de carga con skeletons** (no spinners en blanco) y `Suspense`.
- [ ] **Caché cliente específica** (SWR/TanStack Query) solo en vistas interactivas
      que lo pidan.
- [ ] **Imágenes optimizadas** (`next/image`) y fuentes con `display: swap` (hecho).

### Trabajos en segundo plano
- [x] **Inngest** para envíos, esperas y reintentos: la UI nunca se bloquea por
      tareas largas (emails, secuencias). Las esperas de días son fiables.

## 4. Calidad de código (para uso profesional)
- [x] **TypeScript estricto** (+ `noUncheckedIndexedAccess`).
- [x] **Validación compartida** cliente/servidor con Zod.
- [x] **Capa de datos separada** (`src/server/db`, `actions`, `services`) y UI tonta.
- [x] **Manejo de errores** consistente (toasts claros, estados vacíos cuidados).
- [x] **Accesibilidad** (shadcn/Base UI ya es accesible; mantener labels y focus).
- [x] **Tests e2e** de los flujos críticos con Playwright.

## 5. Cómo verificamos sin Google (entorno de desarrollo)
Existe una ruta **solo de desarrollo** `GET /api/dev-login` que crea una sesión real
en la base de datos y entra como un usuario de prueba, **sin pasar por Google**. Está
gateada a `NODE_ENV=development` (devuelve 404 en producción), así que no es un agujero
de seguridad. Permite a Claude (y a ti) revisar toda la app autenticada al instante.

> Resumen: el plan es seguro y rápido para el objetivo. Estas casillas se irán
> marcando dentro de cada fase; las críticas (Zod, índices, autorización) entran ya
> en la Fase 1.

## 6. Auditoría final 10.7 (2026-07-01)

### Alcance revisado
- Configuración Next/Auth/proxy: `next.config.ts`, `src/proxy.ts`, `src/auth.ts` y
  `src/app/(app)/layout.tsx`.
- Route handlers públicos/privados: exports CSV, adjuntos, backups, formularios,
  tracking, unsubscribe, Resend e Inngest.
- Server Actions y queries: patrón `requireUser()`, validación Zod y filtros `ownerId`.
- Dependencias y supply chain: `pnpm audit --prod`, `pnpm why postcss`.
- Secretos accidentales: búsqueda en archivos trackeados de patrones de claves, URLs de
  conexión y tokens.
- Flujos críticos e2e: auth/proxy, headers, export CSV autenticado, smoke de páginas
  principales y selección de contactos en lista de negocios.

### Correcciones aplicadas
- `next.config.ts`: cabeceras de seguridad globales.
- `pnpm-workspace.yaml`: override `postcss: 8.5.15` para eliminar la resolución
  vulnerable transitiva.
- `src/server/db/index.ts`: singleton lazy para Drizzle/Postgres; Auth.js usa `getDb()`
  porque su adapter necesita una instancia Drizzle real.
- `playwright.config.ts` + `tests/e2e/*`: suite e2e no destructiva, sin vídeo para evitar
  dependencia de `ffmpeg`; usa Chrome del sistema si existe o Chromium instalado por
  Playwright.

### Comandos de revisión
- `pnpm audit --prod`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm e2e` con `pnpm dev` ya levantado.

### Riesgo residual aceptado
- **CSP estricta** queda pendiente de una tarea específica: requiere nonce/hashes y pruebas
  cuidadosas con Next, Base UI, TipTap y estilos inline.
- **RLS Supabase** sigue como defensa en profundidad futura porque el cliente no accede
  directamente a Supabase/BD.
- **Rotación de credenciales** compartidas sigue pendiente operativa: hacerlo antes de
  producción real.
