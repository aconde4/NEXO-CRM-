# ESTADO ACTUAL · (archivo vivo)

> **Este es el primer archivo que se lee al retomar el proyecto.** Indica exactamente
> dónde estamos y qué hacer a continuación. Se actualiza al final de cada sesión y
> al terminar cada tarea.

---

## 📍 Dónde estamos

- **Fase activa:** FASE 0 · Fundaciones — **en curso (~80% hecho)**.
- **Hecho:** scaffold Next.js 16, sistema de diseño (claro/oscuro), app shell
  completo (sidebar + topbar + todas las secciones), Drizzle + esquema Auth.js,
  Inngest (cliente + función demo + endpoint), entorno y primer commit.
- **Estado del repo:** git inicializado, 1 commit (`Fase 0: fundaciones…`). Sin
  remoto en GitHub todavía.
- **Compila:** `pnpm build` ✅ y `pnpm typecheck` ✅. App previsualizada OK.

## ⏭️ Siguiente paso concreto

**Bloqueado a la espera del usuario:** crear las cuentas externas siguiendo
[`SETUP.md`](SETUP.md) (Supabase §1 y Google OAuth §2 son las imprescindibles) y
pegar los valores en `.env.local`.

Cuando el usuario diga **“ya tengo Supabase y Google”**, Claude hará (en este orden):
1. `pnpm db:push` → crear las tablas (tarea 0.8).
2. Escribir y conectar Auth.js v5 + Google + allowlist + login + middleware
   (tareas 0.9, 0.10, 0.12): `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`,
   `src/app/(auth)/login/page.tsx`, `src/middleware.ts`, y sustituir el
   `placeholderUser` de `src/app/(app)/layout.tsx` por la sesión real.
3. Probar el login en local.
4. (Opcional) Desplegar en Vercel + GitHub (tareas 0.5 remoto, 0.15, 0.16).

Después → **FASE 1 · Contactos y Empresas**.

## 🔁 Cómo retomar (resumen)

1. Lee este archivo y la FASE activa en `04-ROADMAP-DETALLADO.md`.
2. Verifica el estado real: `git log --oneline -15` y `git status`.
3. Continúa por la primera tarea `[ ]` sin marcar.
4. Al terminar: marca el checkbox, commit, y actualiza este archivo.

## ✅ Prerrequisitos del entorno

- [x] `pnpm` (v10.33), `git` (v2.54), Node.js (v24.16 vía pnpm).
- [ ] Proyecto Supabase creado → `.env.local` (DATABASE_URL, DIRECT_URL).
- [ ] Credenciales OAuth de Google → `.env.local` (GOOGLE_CLIENT_ID/SECRET).
- [ ] Repo en GitHub (opcional ahora).
- [ ] Cuenta Vercel + Inngest (al desplegar).

## ⚠️ Notas del entorno

- El proyecto está dentro de **OneDrive**. Recomendado excluir `node_modules` y
  `.next` de la sincronización de OneDrive para evitar lentitud y bloqueos de
  archivos (clic derecho en la carpeta → "Liberar espacio"/"Always keep on device"
  según convenga, o mover el proyecto fuera de OneDrive si da problemas).
- Marca/nombre de la app: **"Nexo CRM"** (fácil de cambiar en `layout.tsx`,
  `app-sidebar.tsx` y `package.json`).

## 🚧 Decisiones pendientes / dudas abiertas

- (ninguna) — las 4 decisiones de producto están cerradas (ver
  `00-VISION-Y-PLAN-MAESTRO.md` §2).

---

## 🗒️ Changelog por sesión

### 2026-06-16 (2) — Fase 0: fundaciones
- Instalado Node 24.16; scaffold Next.js 16 + TS + Tailwind v4 + shadcn (Base UI).
- Sistema de diseño propio (slate + índigo) en claro/oscuro; `ThemeProvider`.
- App shell completo: `AppSidebar`, `AppTopbar`, panel con métricas y "primeros
  pasos", y páginas de todas las secciones (placeholder "próximamente").
- Drizzle ORM: `drizzle.config.ts`, cliente `src/server/db`, esquema Auth.js.
- Inngest: cliente, función demo y endpoint `/api/inngest`.
- Entorno: `.env.example`, `.env.local` (con `AUTH_SECRET`), `.gitattributes`,
  scripts de calidad y migraciones. `CLAUDE.md` con guía del proyecto.
- `git init` + primer commit (`f097101`). Build y typecheck en verde.
- **Pendiente:** que el usuario cree Supabase + Google OAuth (ver `SETUP.md`) para
  conectar BD y login.

### 2026-06-16 (1) — Planificación inicial
- Investigadas las funcionalidades de Pipedrive y definidas mejoras.
- Cerradas las 4 decisiones de producto (modo, email doble, nube, MVP).
- Creada la documentación del plan en `docs/` + `README.md`.
