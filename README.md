# CRM (proyecto personal estilo Pipedrive, mejorado)

CRM personal y autoalojado, inspirado en Pipedrive pero más potente: gestión de
contactos y empresas, embudos visuales de ventas, correo 1:1, campañas masivas,
secuencias/drip, automatizaciones visuales, reporting, documentos, presupuestos,
PWA e IA agnóstica configurable.

> **Estado del proyecto:** roadmap principal cerrado hasta Fase 10. Antes de construir
> una nueva fase toca decidir el siguiente bloque: despliegue/operación real,
> endurecimiento CSP/RLS/rotación de credenciales o nuevas funcionalidades. Retoma
> siempre por [`docs/ESTADO-ACTUAL.md`](docs/ESTADO-ACTUAL.md).

## 🚀 Arrancar en local

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Copia `.env.example` a `.env.local` y rellena los valores del entorno que vayas a
usar siguiendo [`docs/SETUP.md`](docs/SETUP.md).

## 📚 Documentación (léela en este orden)

1. [`docs/00-VISION-Y-PLAN-MAESTRO.md`](docs/00-VISION-Y-PLAN-MAESTRO.md) — Qué
   construimos, por qué, mejoras sobre Pipedrive y **cómo retomar el trabajo si te
   quedas sin créditos** (protocolo de reanudación). **Empieza aquí.**
2. [`docs/01-ARQUITECTURA-Y-STACK.md`](docs/01-ARQUITECTURA-Y-STACK.md) — Stack
   técnico, decisiones, estructura de carpetas, cuentas a crear y costes.
3. [`docs/02-MODELO-DE-DATOS.md`](docs/02-MODELO-DE-DATOS.md) — Todas las entidades
   y el esquema de base de datos.
4. [`docs/03-PARIDAD-PIPEDRIVE-Y-MEJORAS.md`](docs/03-PARIDAD-PIPEDRIVE-Y-MEJORAS.md)
   — Matriz de funcionalidades de Pipedrive y nuestras mejoras.
5. [`docs/04-ROADMAP-DETALLADO.md`](docs/04-ROADMAP-DETALLADO.md) — El plan de
   construcción fase por fase, tarea por tarea, con checklists.
6. [`docs/05-SEGURIDAD-Y-RENDIMIENTO.md`](docs/05-SEGURIDAD-Y-RENDIMIENTO.md) —
   Revisión de seguridad, rendimiento y calidad.
7. [`docs/06-CAMPOS-Y-PERSONALIZACION.md`](docs/06-CAMPOS-Y-PERSONALIZACION.md) —
   Campos personalizados, importación Excel/CSV y personalización de email.
8. [`docs/ESTADO-ACTUAL.md`](docs/ESTADO-ACTUAL.md) — **El archivo vivo**: en qué
   fase y tarea exacta estamos ahora mismo. Se actualiza en cada sesión.

## 🧭 Decisiones tomadas (16/06/2026)

- **Modo de trabajo:** mixto, con asistentes de código y estado persistente en disco.
- **Email:** secuencias 1:1 (vía Gmail) **y** campañas masivas (vía Resend) por igual.
- **Hosting:** en la nube, 24/7, coste casi cero al inicio.
- **Primer MVP:** Contactos + Pipeline.

## ⚡ Resumen del stack

Next.js 16 (App Router, TypeScript) · Tailwind v4 + shadcn/ui (Base UI) ·
PostgreSQL (Supabase) · Drizzle ORM · Auth.js (Google) · Inngest · Gmail API
(1:1) · Resend (masivo) · IA agnóstica vía `AI_PROVIDER` · Vercel.

Todo con plan gratuito al inicio. Detalles y justificación en
[`docs/01-ARQUITECTURA-Y-STACK.md`](docs/01-ARQUITECTURA-Y-STACK.md).
