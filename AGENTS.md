<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Nexo CRM — guía para cualquier asistente (Claude, Codex…)

CRM personal autoalojado estilo Pipedrive, mejorado (Next.js 16, App Router + RSC).
**Esta guía la leen todos los asistentes; mantenla agnóstica.** Las notas específicas
de Claude están en `CLAUDE.md` (que importa este archivo).

## 🔴 Antes de tocar nada (protocolo de reanudación)

1. Lee **`docs/ESTADO-ACTUAL.md`** — es la **fuente de verdad**: fase actual, última
   tarea hecha y la siguiente exacta. Lee también la fase activa en
   `docs/04-ROADMAP-DETALLADO.md`.
2. Verifica el estado real del código: `git log --oneline -15` y `git status`.
3. Continúa por la **primera tarea `[ ]` sin marcar** de la fase activa (de arriba
   abajo; no saltes fases).
4. **Al terminar cada tarea:** marca su checkbox en el roadmap, deja los gates en verde
   (ver "Gates de calidad"), **haz commit** y **actualiza `docs/ESTADO-ACTUAL.md`**
   (sección "Siguiente paso" + un apunte en el changelog).

> Regla de oro: alguien debe poder leer `ESTADO-ACTUAL.md` + `git log` y saber en
> 30 s qué hacer a continuación. Protocolo completo en
> `docs/00-VISION-Y-PLAN-MAESTRO.md` §4.

## Alternar entre asistentes (Claude ⇄ Codex)

El estado vive en disco, no en la memoria del asistente, así que el relevo es seguro:

- **Cambia entre tareas, nunca a mitad.** Deja un commit limpio + `ESTADO-ACTUAL.md`
  actualizado antes de soltar el testigo.
- El asistente que entra hace el arranque de arriba y respeta estas convenciones y
  gates. Así el código sale consistente sin importar quién lo escriba.

## Stack

Next.js 16 (App Router, RSC) · TypeScript estricto · Tailwind v4 · shadcn/ui
(**Base UI**: usa `render` en vez de `asChild`) · Drizzle ORM + PostgreSQL (Supabase) ·
Auth.js v5 (Google) · Inngest · Gmail API + Resend · Claude API. Gestor: **pnpm**
(Node vía `pnpm env`).

## Comandos

- `pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm format`
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio`
- `pnpm db:seed` — datos de ejemplo (empresas, contactos, etiquetas, actividades,
  campos personalizados, embudo con negocios). Es idempotente.

## Convenciones

- UI de shadcn/Base UI en `src/components/ui`; UI propia en `src/components`; lógica de
  servidor en `src/server` (`db`, `actions`, `queries`, `services`, `inngest`).
- **Toda mutación pasa por una Server Action con validación Zod** (esquemas en
  `src/lib/validations`). Autorización por propietario (`ownerId`) en cada query/action.
- Idioma de la interfaz: **español**.
- Secretos solo en `.env.local` (está en `.gitignore`; nunca al repo).
- Base UI: para enlaces usa `render={<Link href=… />}` (no `asChild`). En botones que
  son enlaces, el aviso `nativeButton` de Base UI es esperado y cosmético.
- Tablas propias (no TanStack todavía); para selects, `<select>` nativo estilizado;
  formularios con **react-hook-form + zodResolver**. Patrón de diálogos: re-montar el
  cuerpo del formulario al abrir (`key` + render condicional `open && …`) para tener
  estado inicial limpio **sin efectos** (evita avisos de react-hooks).

## Gates de calidad (antes de cada commit)

- `pnpm typecheck`, `pnpm build` y `pnpm lint` en verde. **`pnpm lint` debe quedar a
  cero** (ya no hay errores preexistentes). No introduzcas errores ni avisos nuevos.
- El aviso `nativeButton` de Base UI (botones con `render={<Link/>}`) es **cosmético y
  esperado** en dev; no lo cuentes como error.
- **Commit por tarea.** Identidad de git: este equipo **no tiene `user.name/email`
  configurados** (commitear directo falla con "Author identity unknown"). Usa:
  `git -c user.name="acondeuceda" -c user.email="acondeuceda@gmail.com" commit -m "…"`
  y termina el mensaje con la línea `Co-Authored-By:` del asistente.

## Migraciones y base de datos

- Esquema Drizzle en `src/server/db/schema`. Genera y aplica con
  `pnpm db:generate` + `pnpm db:migrate` (**NO** `db:push`: pide TTY interactiva). Las
  migraciones quedan en `drizzle/` (van al repo).
- Supabase: la contraseña con `@` se codifica como `%40` en la URL. `DIRECT_URL`
  (session pooler, 5432) para migraciones; `DATABASE_URL` (transaction pooler, 6543)
  para la app.

## Probar y verificar (aún sin desplegar)

- **Login sin Google:** `GET /api/dev-login` (solo en dev) crea una sesión real; o el
  enlace "Entrar como desarrollador" en `/login`.
- Verifica leyendo el **DOM** de la página renderizada, con **`fetch`** (para CSV/rutas
  API), o a nivel de **BD** con un script `tsx` temporal (que borras después). No te
  fíes solo de que compile.
- Los **adjuntos** (Supabase Storage) necesitan `SUPABASE_SERVICE_ROLE_KEY` + un bucket
  privado `attachments` (ver `SETUP.md`). Sin eso, la app degrada con elegancia (el
  panel "Archivos" aparece desactivado).

## Documentación del plan

`docs/00-VISION-Y-PLAN-MAESTRO.md` (visión + protocolo) · `docs/02-MODELO-DE-DATOS.md`
(modelo objetivo) · `docs/04-ROADMAP-DETALLADO.md` (roadmap con checkboxes) ·
`docs/ESTADO-ACTUAL.md` (estado vivo) · `SETUP.md` (cuentas/credenciales).
