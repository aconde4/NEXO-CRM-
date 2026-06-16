# ESTADO ACTUAL · (archivo vivo)

> **Este es el primer archivo que se lee al retomar el proyecto.** Indica exactamente
> dónde estamos y qué hacer a continuación. Se actualiza al final de cada sesión y
> al terminar cada tarea.

---

## 📍 Dónde estamos

- **Fase activa:** FASE 0 · Fundaciones — **~95% hecho**.
- **Hecho:** scaffold Next.js 16, diseño (claro/oscuro), app shell completo,
  Drizzle + Inngest, **Supabase conectado y migración aplicada (5 tablas)**, y
  **Auth.js v5 con Google montado**: `src/auth.ts`, endpoint `/api/auth`, página
  `/login`, `src/proxy.ts` (gate edge por cookie), gate real con `auth()` en
  `(app)/layout.tsx`, allowlist y logout.
- **Estado del repo:** git, varios commits. Sin remoto en GitHub todavía.
- **Compila:** `pnpm build` ✅ y `pnpm typecheck` ✅. `/login` renderiza y la
  redirección a login funciona (verificado).

## ⏭️ Siguiente paso concreto

**Prueba del login (la haces tú, requiere el clic real en Google):**
1. `pnpm dev` → abre http://localhost:3000 → te lleva a `/login`.
2. Pulsa **Continuar con Google**, elige tu cuenta (`acondeuceda@gmail.com`).
3. Debes acabar en `/dashboard` con tu nombre/foto en el menú inferior.
   - Si Google da error "acceso bloqueado": añade tu correo como **usuario de
     prueba** en la pantalla de consentimiento (SETUP.md §2, paso 2).

Cuando el login funcione, las opciones son:
- **Seguir a FASE 1 · Contactos** (recomendado), o
- **Desplegar a la nube** (GitHub + Vercel + Inngest; tareas 0.5 remoto/0.15/0.16,
  guía en SETUP.md §3-5). Recordar añadir la redirect URI de producción en Google.

> Seguridad: las credenciales se pegaron en el chat. Cuando todo funcione, conviene
> **rotar** la contraseña de Supabase y el secreto de Google.

## 🔁 Cómo retomar (resumen)

1. Lee este archivo y la FASE activa en `04-ROADMAP-DETALLADO.md`.
2. Verifica el estado real: `git log --oneline -15` y `git status`.
3. Continúa por la primera tarea `[ ]` sin marcar.
4. Al terminar: marca el checkbox, commit, y actualiza este archivo.

## ✅ Prerrequisitos del entorno

- [x] `pnpm` (v10.33), `git` (v2.54), Node.js (v24.16 vía pnpm).
- [x] Proyecto Supabase creado y conectado (eu-west-1); migración aplicada.
- [x] Credenciales OAuth de Google en `.env.local`.
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

### 2026-06-16 (3) — Fase 0: base de datos + login
- Conectado Supabase (credenciales en `.env.local`, contraseña con `@`→`%40`).
- Migración aplicada con `db:generate` + `db:migrate` (5 tablas de Auth.js).
- Auth.js v5 + Google: `src/auth.ts` (adapter Drizzle, sesión en BD, allowlist,
  refresh_token para Gmail futuro), endpoint `/api/auth`, página `/login` con diseño,
  `src/proxy.ts` (gate edge por cookie), gate con `auth()` en `(app)/layout.tsx`,
  logout funcional. Renombrado middleware→proxy (convención Next 16).
- Build y typecheck en verde; `/login` verificado.
- **Pendiente:** prueba E2E del login con Google (la hace el usuario) y despliegue.

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
