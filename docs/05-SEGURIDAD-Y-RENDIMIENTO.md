# 05 · Seguridad y Rendimiento (revisión)

Revisión del plan y del estado actual para que el CRM sea **seguro, rápido y de
calidad profesional**. Pensado para **pocos usuarios** (uso personal/equipo
pequeño): se prioriza solidez y fluidez sobre escala masiva, sin sobre-ingeniería.

## 1. Veredicto

El stack y el plan son **adecuados y seguros** para este caso. Arquitectura
serverless (Vercel + Supabase + Inngest) = sin servidores que mantener, coste casi
cero y suficiente rendimiento de sobra para pocos usuarios. No hay que cambiar de
rumbo; sí incorporamos las buenas prácticas de abajo a medida que construimos.

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

### A incorporar 🔜
- [ ] **Validación Zod en TODA mutación** (server actions) — entrada nunca confiable.
- [ ] **Autorización por propietario:** cada consulta filtra por `owner_id` (aunque
      ahora seas solo tú, deja el patrón listo para multiusuario).
- [ ] **Cabeceras de seguridad** en `next.config.ts` (HSTS, X-Content-Type-Options,
      Referrer-Policy, X-Frame-Options) — se añaden al desplegar.
- [ ] **Rate limiting** en endpoints públicos (formularios web de la Fase 7) +
      honeypot anti-spam.
- [ ] **RLS en Supabase** como defensa en profundidad (baja prioridad: el acceso ya
      es solo servidor; se activa si algún día hubiera acceso directo desde cliente).
- [ ] **RGPD** (Fase 4): consentimiento, baja, supresión, export y borrado de datos.
- [ ] **Webhooks firmados** (Resend, Inngest) — verificar firma siempre.
- [ ] **Rotar credenciales** compartidas en chat (contraseña Supabase + secreto
      Google) una vez todo funcione. ⚠️ Pendiente.
- [ ] **Backups:** Supabase hace copias automáticas; añadimos export propio (Fase 1).

## 3. Rendimiento y fluidez

### Base de datos
- [x] **Pooling correcto:** la app usa el *Transaction pooler* (PgBouncer) con
      `prepare: false`; las migraciones, el *Session pooler*. Ideal para serverless.
- [ ] **Índices** desde la Fase 1: en claves foráneas (`org_id`, `owner_id`,
      `deal_id`…) y en columnas de búsqueda/orden (email, nombre, `created_at`,
      `stage_id`). Con índices, las tablas van fluidas aunque crezcan los datos.
- [ ] **Sin N+1:** usar joins/`with` de Drizzle en vez de consultas en bucle.
- [ ] **Paginación** en todos los listados (no traer miles de filas de golpe).

### Front-end / percepción de velocidad
- [x] **React Server Components + Server Actions:** menos JS al cliente, datos en el
      servidor, navegación rápida.
- [ ] **UI optimista** en acciones frecuentes (crear/editar/mover) → respuesta
      instantánea, se confirma en segundo plano.
- [ ] **Estados de carga con skeletons** (no spinners en blanco) y `Suspense`.
- [ ] **TanStack Query** para cachear e invalidar datos en vistas interactivas.
- [ ] **Imágenes optimizadas** (`next/image`) y fuentes con `display: swap` (hecho).

### Trabajos en segundo plano
- [x] **Inngest** para envíos, esperas y reintentos: la UI nunca se bloquea por
      tareas largas (emails, secuencias). Las esperas de días son fiables.

## 4. Calidad de código (para uso profesional)
- [x] **TypeScript estricto** (+ `noUncheckedIndexedAccess`).
- [ ] **Validación compartida** cliente/servidor con Zod.
- [ ] **Capa de datos separada** (`src/server/db`, `actions`, `services`) y UI tonta.
- [ ] **Manejo de errores** consistente (toasts claros, estados vacíos cuidados).
- [ ] **Accesibilidad** (shadcn/Base UI ya es accesible; mantener labels y focus).
- [ ] **Tests** de los flujos críticos (Vitest + Playwright) antes de cerrar fases
      grandes.

## 5. Cómo verificamos sin Google (entorno de desarrollo)
Existe una ruta **solo de desarrollo** `GET /api/dev-login` que crea una sesión real
en la base de datos y entra como un usuario de prueba, **sin pasar por Google**. Está
gateada a `NODE_ENV=development` (devuelve 404 en producción), así que no es un agujero
de seguridad. Permite a Claude (y a ti) revisar toda la app autenticada al instante.

> Resumen: el plan es seguro y rápido para el objetivo. Estas casillas se irán
> marcando dentro de cada fase; las críticas (Zod, índices, autorización) entran ya
> en la Fase 1.
