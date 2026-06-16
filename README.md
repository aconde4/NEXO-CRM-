# CRM (proyecto personal estilo Pipedrive, mejorado)

CRM personal y autoalojado, inspirado en Pipedrive pero más potente: gestión de
contactos y empresas, embudos visuales de ventas, envío de correos 1:1 y campañas
masivas, secuencias/drip, un motor de automatizaciones visual y IA integrada
(Claude) en todo el flujo.

> **Estado del proyecto:** en fase de planificación. Aún no se ha escrito código de
> la aplicación. Todo el plan está en la carpeta [`docs/`](docs/).

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
6. [`docs/ESTADO-ACTUAL.md`](docs/ESTADO-ACTUAL.md) — **El archivo vivo**: en qué
   fase y tarea exacta estamos ahora mismo. Se actualiza en cada sesión.

## 🧭 Decisiones tomadas (16/06/2026)

- **Modo de trabajo:** mixto, Claude construye y explica lo esencial.
- **Email:** secuencias 1:1 (vía Gmail) **y** campañas masivas (vía Resend) por igual.
- **Hosting:** en la nube, 24/7, coste casi cero al inicio.
- **Primer MVP:** Contactos + Pipeline.

## ⚡ Resumen del stack

Next.js (App Router, TypeScript) · Tailwind + shadcn/ui · PostgreSQL (Supabase) ·
Drizzle ORM · Auth.js (Google) · Inngest (motor de automatizaciones/colas) ·
Gmail API (1:1) · Resend (masivo) · Claude API (IA) · Vercel (hosting).

Todo con plan gratuito al inicio. Detalles y justificación en
[`docs/01-ARQUITECTURA-Y-STACK.md`](docs/01-ARQUITECTURA-Y-STACK.md).
