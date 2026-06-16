# 01 · Arquitectura y Stack

## 1. Filosofía técnica

- **Una sola base de código full-stack** (Next.js): menos piezas, despliegue
  trivial, ideal para un proyecto personal mantenido por una persona + Claude.
- **Serverless por defecto** (Vercel + Supabase + Inngest): cero servidores que
  administrar, escala a cero (no pagas si no se usa), planes gratuitos generosos.
- **Tipado de extremo a extremo** (TypeScript + Drizzle + Zod): el tipo de la base
  de datos llega hasta el formulario. Menos bugs, mejor autocompletado.
- **Workflows duraderos para todo lo asíncrono** (Inngest): secuencias, esperas,
  reintentos y envíos programados sin montar Redis ni workers propios.

## 2. Stack elegido (y por qué)

| Capa | Elección | Por qué esta y no otra |
|---|---|---|
| **Framework** | **Next.js 15** (App Router, RSC, Server Actions) + **TypeScript** | Front + back en un repo, despliegue en Vercel en 1 clic, gran ecosistema. |
| **UI** | **Tailwind CSS** + **shadcn/ui** (Radix) | Componentes accesibles que copias a tu repo (los controlas tú), look moderno, rápido de iterar. |
| **Tablas** | **TanStack Table** | Listados de contactos/negocios con orden, filtros y paginación a medida. |
| **Drag & drop** | **dnd-kit** | Kanban del pipeline fluido y accesible. |
| **Gráficas** | **Recharts** (+ **Tremor** para dashboards) | Paneles de analítica sin reinventar nada. |
| **Base de datos** | **PostgreSQL** en **Supabase** | Postgres serio (relaciones, JSONB para campos personalizados), free tier con auth y storage incluidos. |
| **ORM / migraciones** | **Drizzle ORM** + drizzle-kit | Tipado total, migraciones SQL legibles (las puedes leer tú), excelente en serverless. *(Alternativa: Prisma.)* |
| **Auth** | **Auth.js (NextAuth) v5** con **Google** | Inicias sesión con tu Gmail **y** reutilizamos ese OAuth para la Gmail API (matar dos pájaros). Monousuario con allowlist de tu email. |
| **Cola / workflows / cron** | **Inngest** | `step.sleep`, `waitForEvent` y reintentos nativos = secuencias y "esperar respuesta" casi gratis. Corre sobre Vercel. |
| **Email 1:1** | **Gmail API** (OAuth) | Envía desde tu buzón real → hilos, firma y máxima entregabilidad. Detecta respuestas para parar secuencias. |
| **Email masivo** | **Resend** (escala futura: **Amazon SES**) | API limpia, plantillas con React Email, free tier 3.000/mes. SES cuando haya gran volumen ($0,10/1.000). |
| **Plantillas de email** | **React Email** | Diseñas correos como componentes React, render fiable en clientes de correo. |
| **Editor de texto** | **Tiptap** | Redactor de correos y notas WYSIWYG. |
| **Validación / formularios** | **Zod** + **react-hook-form** | Validación compartida cliente/servidor. |
| **Datos en cliente** | **TanStack Query** | Caché, refetch e invalidación de las llamadas a la API. |
| **Import CSV** | **papaparse** | Importación de contactos con mapeo de columnas. |
| **Fechas** | **date-fns** + **date-fns-tz** | Manejo de zonas horarias para envíos programados. |
| **IA** | **Claude API** (`@anthropic-ai/sdk`, modelos `claude-opus-4-8` / `claude-sonnet-4-6`) | Redacción, resúmenes, scoring, automatizaciones por lenguaje natural. |
| **Tests** | **Vitest** (unit) + **Playwright** (e2e) | Confianza al refactorizar. |
| **Hosting** | **Vercel** (app) + **Supabase** (BD) + **Inngest** (jobs) | Todo free al inicio, push-to-deploy. |
| **Gestor de paquetes** | **pnpm** | Ya lo tienes instalado (v10.33). Rápido y eficiente en disco. |

> **Nota sobre Node:** en este equipo `node`/`npm` no están en el PATH, pero `pnpm`
> sí. En la Fase 0 instalamos Node con `pnpm env use --global lts` (pnpm puede
> gestionar Node) o desde nodejs.org. Lo dejamos resuelto antes de empezar.

## 3. Arquitectura de email (la parte crítica de tu proyecto)

Hay **dos caminos de envío** porque resuelven problemas distintos:

```
                    ┌─────────────────────────────────────┐
                    │              CRM (Next.js)            │
                    └───────────────┬─────────────┬────────┘
                                    │             │
              Secuencias 1:1        │             │   Campañas masivas
              (parecen personales)  │             │   (newsletters/promos)
                                    ▼             ▼
                            ┌──────────────┐  ┌──────────────┐
                            │  Gmail API   │  │    Resend    │
                            │ (tu buzón)   │  │ (dominio     │
                            │              │  │  propio)     │
                            └──────┬───────┘  └──────┬───────┘
                                   │                 │
                     hilos reales, │                 │  tracking, bajas,
                     límite diario │                 │  rebotes, métricas
                                   ▼                 ▼
                            ┌─────────────────────────────────┐
                            │  Inngest (programación, lotes,   │
                            │  esperas, reintentos, cron)      │
                            └─────────────────────────────────┘
```

- **1:1 / secuencias → Gmail API.** Aspecto personal, alta entregabilidad, hilos.
  Respetamos un **límite diario por buzón** (warm-up) para no quemar tu cuenta.
- **Masivo / campañas → Resend.** Requiere un **dominio de envío propio** con
  SPF + DKIM + DMARC. Incluye tracking de aperturas/clics, gestión de **bajas
  (unsubscribe)** y manejo de **rebotes/quejas** vía webhooks.
- **Inngest orquesta** ambos: programa envíos, trocea en lotes para respetar
  límites, gestiona esperas de las secuencias y reintenta fallos.

> **Entregabilidad y RGPD** (transversal): doble opt-in opcional, lista de
> supresión global, cabecera `List-Unsubscribe`, pixel/links propios para tracking,
> y nunca enviar a quien se dio de baja. Detallado en el roadmap (Fase 4).

## 4. Estructura de carpetas (objetivo)

```
CRM/
├── docs/                         # Esta documentación (el plan)
├── src/
│   ├── app/                      # Rutas Next.js (App Router)
│   │   ├── (auth)/               # Login
│   │   ├── (app)/                # App protegida: contactos, deals, email...
│   │   │   ├── contacts/
│   │   │   ├── organizations/
│   │   │   ├── deals/            # Pipeline kanban
│   │   │   ├── inbox/            # Bandeja de email unificada
│   │   │   ├── campaigns/
│   │   │   ├── sequences/
│   │   │   ├── automations/
│   │   │   ├── forms/
│   │   │   └── analytics/
│   │   └── api/
│   │       ├── auth/             # Auth.js
│   │       ├── inngest/          # Endpoint de Inngest
│   │       └── webhooks/         # Resend, Gmail push, formularios
│   ├── components/               # UI reutilizable (shadcn + propios)
│   ├── server/
│   │   ├── db/                   # Drizzle: schema, cliente, migraciones
│   │   ├── actions/              # Server Actions (mutaciones)
│   │   ├── services/             # Lógica: email, gmail, resend, ai, scoring
│   │   └── inngest/              # Funciones de workflow (secuencias, automatizaciones)
│   ├── lib/                      # Utilidades, validadores Zod, helpers
│   └── styles/
├── drizzle/                      # Migraciones SQL generadas
├── tests/                        # Vitest + Playwright
├── .env.local                    # Secretos (NUNCA al repo)
├── .env.example                  # Plantilla de variables (SÍ al repo)
└── package.json
```

## 5. Cuentas y servicios a crear (todas con plan gratis)

> No hace falta crearlas ahora; el roadmap indica cuándo se necesita cada una.

| Servicio | Para qué | Cuándo | Coste inicial |
|---|---|---|---|
| **GitHub** | Repositorio + despliegue automático | Fase 0 | Gratis |
| **Vercel** | Hosting de la app | Fase 0 | Gratis (Hobby) |
| **Supabase** | Base de datos PostgreSQL | Fase 0 | Gratis |
| **Google Cloud Console** | OAuth + Gmail API | Fase 0 (login) / Fase 3 (Gmail) | Gratis |
| **Inngest** | Motor de jobs/workflows | Fase 0 | Gratis |
| **Resend** | Envío masivo de email | Fase 4 | Gratis (3.000/mes) |
| **Anthropic (Claude API)** | Funciones de IA | Fase 8 | De pago por uso (barato) |
| **Dominio propio** | Envío de campañas (SPF/DKIM) | Fase 4 | ~10 €/año (ya tienes seestem.eu) |

## 6. Variables de entorno (irán en `.env.example`)

```bash
# Base de datos (Supabase)
DATABASE_URL=               # conexión con pooler (para la app)
DIRECT_URL=                 # conexión directa (para migraciones)

# Auth.js + Google OAuth
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAILS=acondeuceda@gmail.com   # allowlist monousuario

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Resend (Fase 4)
RESEND_API_KEY=
EMAIL_SENDING_DOMAIN=

# Claude (Fase 8)
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

## 7. Modelo de costes (resumen)

- **Fases 0–3:** 0 €/mes (Vercel + Supabase + Inngest + Gmail, todo free).
- **Fase 4+:** sigue 0 € hasta superar 3.000 emails/mes en Resend; el dominio ya lo
  tienes. Si creces mucho, se migra el masivo a Amazon SES (~0,10 €/1.000).
- **Fase 8 (IA):** pago por uso de Claude API; con cachés y modelos adecuados,
  céntimos por operación. Controlable y opcional.

---

➡️ Siguiente lectura: [`02-MODELO-DE-DATOS.md`](02-MODELO-DE-DATOS.md)
