@AGENTS.md

# Nexo CRM — guía para Claude

CRM personal estilo Pipedrive (mejorado). **Antes de tocar nada, lee
`docs/ESTADO-ACTUAL.md`** para saber en qué fase y tarea estamos, y el protocolo de
reanudación en `docs/00-VISION-Y-PLAN-MAESTRO.md` §4.

## Al retomar el trabajo
1. Lee `docs/ESTADO-ACTUAL.md` (fase y siguiente tarea) y la fase activa en
   `docs/04-ROADMAP-DETALLADO.md`.
2. Verifica el estado real: `git log --oneline -15` y `git status`.
3. Continúa por la primera tarea sin marcar. Al terminar: marca el checkbox, haz
   commit y actualiza `docs/ESTADO-ACTUAL.md`.

## Stack
Next.js 16 (App Router, RSC) · TypeScript estricto · Tailwind v4 · shadcn/ui
(**Base UI**, usa `render` en lugar de `asChild`) · Drizzle ORM + PostgreSQL
(Supabase) · Auth.js v5 (Google) · Inngest · Gmail API + Resend · Claude API.

## Comandos
- `pnpm dev` — desarrollo · `pnpm build` — build · `pnpm typecheck` — tipos
- `pnpm lint` · `pnpm format`
- `pnpm db:generate` / `db:migrate` / `db:push` / `db:studio` — base de datos
- Vista previa: usar el MCP de Claude Preview (config en `.claude/launch.json`).

## Convenciones
- Componentes UI en `src/components/ui` (shadcn, Base UI). UI propia en
  `src/components`. Lógica de servidor en `src/server` (db, actions, services, inngest).
- Toda mutación con validación Zod. Idioma de la interfaz: **español**.
- Secretos solo en `.env.local` (nunca al repo). Plantilla en `.env.example`.
- shadcn/Base UI: para enlaces usa `render={<Link href=… />}`, no `asChild`.

## Notas de desarrollo (gotchas importantes)
- **Probar sin Google:** abre `http://localhost:3000/api/dev-login` (solo en dev) o
  el enlace "Entrar como desarrollador" en `/login`. Crea una sesión real sin OAuth.
- **Datos de ejemplo:** `pnpm db:seed` (empresas, contactos y etiquetas).
- **Verificación con Claude Preview:** las **lecturas** del DOM con `preview_eval`
  funcionan; pero `preview_screenshot` falla por el websocket HMR en dev, y las
  **superposiciones de Base UI** (popover, dropdown, command/⌘K, dialog) **no se abren
  con clics sintéticos** del navegador headless. Verifica leyendo el DOM o a nivel de
  BD con un script `tsx`, no con capturas ni clics en overlays.
- **Migraciones:** usar `pnpm db:generate` + `pnpm db:migrate` (NO `db:push`, que pide
  TTY interactiva).
- **Entorno:** `pnpm` (Node vía `pnpm env`). Contraseña de Supabase con `@` va
  codificada como `%40` en la URL de conexión.
- **Tablas/formularios:** tablas propias (no TanStack aún); para selects, `<select>`
  nativo estilizado. Formularios con react-hook-form + zodResolver.
