# 04 · Roadmap Detallado (plan de construcción)

> **Cómo se usa este archivo:** se construye **de arriba abajo**. Cada `[ ]` es una
> tarea ≈ un commit. Al terminar una tarea: marca `[x]`, haz commit y actualiza
> [`ESTADO-ACTUAL.md`](ESTADO-ACTUAL.md). No saltes fases: cada una asume que la
> anterior está terminada y desplegada.
>
> Cada fase tiene **Objetivo**, **Tareas** y **Criterios de aceptación** (cuándo se
> considera cerrada).

---

## FASE 0 · Fundaciones

**Objetivo:** app Next.js desplegada en Vercel, con login de Google, esqueleto de
UI, base de datos conectada e Inngest funcionando. Base sobre la que todo lo demás
se apoya.

### Tareas
- [x] **0.1** Instalar Node LTS (`pnpm env use --global lts`) y verificar `node -v`. → Node 24.16.
- [x] **0.2** Crear proyecto Next.js + TypeScript + App Router con pnpm. → Next.js 16.2.9.
- [x] **0.3** Configurar Tailwind CSS + shadcn/ui (tema base, modo claro/oscuro). → Tailwind v4, shadcn (Base UI), paleta slate+índigo.
- [x] **0.4** ESLint + Prettier + `tsconfig` estricto + scripts de `package.json`.
- [~] **0.5** `git init`, primer commit ✅ — falta crear repo en GitHub y subirlo (necesita el usuario, ver SETUP.md §3).
- [x] **0.6** Crear proyecto en Supabase; obtener `DATABASE_URL` y `DIRECT_URL`. → conectado (eu-west-1).
- [x] **0.7** Instalar y configurar Drizzle + drizzle-kit; cliente de BD y esquema Auth.js escritos.
- [x] **0.8** Primera migración aplicada (`db:generate` + `db:migrate`) → 5 tablas creadas en Supabase.
- [x] **0.9** Configurar Auth.js v5 con Google (`src/auth.ts`, endpoint `/api/auth`, refresh_token para Gmail futuro).
- [x] **0.10** Allowlist monousuario: solo `ALLOWED_EMAILS` puede entrar (callback `signIn`).
- [x] **0.11** App shell: sidebar de navegación + topbar + rutas de todas las secciones. → verificado en claro y oscuro.
- [x] **0.12** Página de login + protección de rutas (`proxy.ts` edge + gate con `auth()` en el layout) + logout. → falta solo la prueba E2E con Google (la hace el usuario).
- [x] **0.13** Configurar Inngest (cliente + endpoint `/api/inngest` + función demo).
- [x] **0.14** Crear `.env.example` y `.env.local` (con `AUTH_SECRET` generado); variables documentadas.
- [ ] **0.15** Desplegar en Vercel; variables de producción; push-to-deploy. → SETUP.md §4.
- [ ] **0.16** Verificar OAuth en producción (redirect URIs correctas). → tras 0.15.

> **Estado:** Fase 0 casi completa. BD conectada, login con Google montado y
> protegido, build en verde. Queda: (a) prueba E2E del login con Google (la hace el
> usuario en el navegador), y (b) despliegue 0.5(remoto)/0.15/0.16. Guía:
> [`SETUP.md`](SETUP.md).

### Criterios de aceptación
- Entras en `https://<tu-app>.vercel.app`, inicias sesión con tu Google y ves el
  layout vacío de la app. Cualquier otro email es rechazado.
- `pnpm build` sin errores de TypeScript. Inngest muestra la función registrada.

---

## FASE 1 · Contactos y Empresas

**Objetivo:** gestionar contactos y empresas con campos personalizados, actividades,
notas e importación CSV. El núcleo de datos del CRM.

### Tareas
- [ ] **1.1** Migración: `organizations`, `persons`, `labels`, `entity_labels`,
      `custom_field_defs`, `activities`, `notes`, `files`, `activity_log`.
- [ ] **1.2** Server Actions CRUD de `organizations` (crear/editar/borrar/listar) con
      validación Zod.
- [ ] **1.3** Server Actions CRUD de `persons` (incluye múltiples emails/teléfonos).
- [ ] **1.4** Listado de contactos con TanStack Table: orden, búsqueda, paginación,
      filtros por etiqueta/campo.
- [ ] **1.5** Vistas guardadas (saved views) de filtros.
- [ ] **1.6** Ficha de contacto: datos + edición inline + línea de tiempo (timeline).
- [ ] **1.7** Listado y ficha de empresas (con sus contactos asociados).
- [ ] **1.8** Motor de campos personalizados: definir campos (UI de ajustes) y
      renderizarlos dinámicamente en fichas y formularios.
- [ ] **1.9** Sistema de etiquetas con colores y asignación.
- [ ] **1.10** Actividades/tareas: crear, completar, fechas de vencimiento, vista de
      "pendientes de hoy".
- [ ] **1.11** Notas con editor Tiptap.
- [ ] **1.12** Adjuntos de archivos (Supabase Storage).
- [ ] **1.13** Importación CSV con papaparse: subir, mapear columnas, previsualizar,
      deduplicar por email, importar.
- [ ] **1.14** Exportación a CSV (RGPD + respaldo).
- [ ] **1.15** Registro en `activity_log` de las acciones (para timeline/auditoría).

### Criterios de aceptación
- Importas un CSV de contactos, los ves en una tabla filtrable, abres una ficha,
  editas campos (incluido uno personalizado), registras una actividad y una nota.
- Las empresas muestran sus contactos. Todo desplegado.

---

## FASE 2 · Pipeline / Embudos / Negocios  ← FIN DEL MVP PRIORITARIO

**Objetivo:** embudo visual Kanban con arrastrar y soltar, múltiples pipelines y
previsión. Completa tu prioridad declarada (Contactos + Pipeline).

### Tareas
- [ ] **2.1** Migración: `pipelines`, `stages`, `deals`, `deal_contacts`.
- [ ] **2.2** CRUD de pipelines y etapas (UI de ajustes): nombre, orden,
      probabilidad, días de estancamiento.
- [ ] **2.3** Server Actions de `deals` (crear/editar/borrar, cambiar etapa, marcar
      ganado/perdido con motivo).
- [ ] **2.4** Tablero Kanban con dnd-kit: columnas = etapas, tarjetas = negocios,
      arrastrar entre etapas actualiza `stage_id` y `stage_changed_at`.
- [ ] **2.5** Selector de pipeline (varios embudos) y creación rápida de negocio.
- [ ] **2.6** Ficha de negocio: valor, etapa, contacto/empresa, propietario, cierre
      previsto, actividades, notas, timeline.
- [ ] **2.7** Vincular negocios con contactos/empresas (participantes).
- [ ] **2.8** Indicador de "estancado" (rotting) según `rotting_days`.
- [ ] **2.9** Resumen por columna: nº de negocios y suma de valor por etapa.
- [ ] **2.10** Vista de lista de negocios (alternativa al Kanban) con filtros.
- [ ] **2.11** Previsión ponderada (valor × probabilidad de etapa) básica.

### Criterios de aceptación
- Creas un negocio, lo arrastras entre etapas, lo marcas ganado/perdido, ves el total
  por columna y una previsión. Funciona con 2+ pipelines. Desplegado.
- 🎉 **Hito:** ya tienes un CRM usable a diario para gestionar tu cartera.

---

## FASE 3 · Email 1:1 (integración Gmail)

**Objetivo:** enviar y recibir correos desde dentro del CRM, vinculados a contactos y
negocios, con plantillas y seguimiento de aperturas/clics.

### Tareas
- [ ] **3.1** Ampliar OAuth de Google con scopes de Gmail (envío + lectura).
- [ ] **3.2** Migración: `mailboxes`, `email_threads`, `email_messages`,
      `email_templates`, `email_events`.
- [ ] **3.3** Servicio Gmail: enviar correo (con hilo correcto) usando el refresh
      token guardado.
- [ ] **3.4** Sincronización de entrada: leer mensajes nuevos (Gmail history API o
      polling vía Inngest) y vincularlos al contacto por email.
- [ ] **3.5** Vista de hilo de conversación en la ficha del contacto/negocio.
- [ ] **3.6** Redactor de email (Tiptap) con plantillas y merge tags
      (`{{first_name}}`, etc.).
- [ ] **3.7** Tracking de aperturas (pixel propio) y de clics (redirección propia)
      → `email_events`.
- [ ] **3.8** Bandeja de ventas unificada (todos los hilos en un sitio).
- [ ] **3.9** Detección de respuestas (marca `replied`) — base para parar secuencias.
- [ ] **3.10** Límite diario de envío por buzón (warm-up) y firma HTML.

### Criterios de aceptación
- Desde una ficha de contacto envías un email (con plantilla), lo recibes de vuelta y
  ves el hilo, sabes si lo abrió y si hizo clic. Desplegado.

---

## FASE 4 · Campañas masivas (Resend)

**Objetivo:** enviar campañas a segmentos con plantillas, programación, bajas, RGPD y
métricas.

### Tareas
- [ ] **4.1** Crear cuenta Resend; verificar dominio de envío (SPF/DKIM/DMARC) —
      guía paso a paso en el propio CRM.
- [ ] **4.2** Migración: `campaigns`, `campaign_recipients`, `segments`,
      `suppressions`.
- [ ] **4.3** Servicio Resend: envío individual y por lotes.
- [ ] **4.4** Constructor de segmentos por filtros (reutiliza el motor de filtros de
      la Fase 1); previsualización del tamaño de audiencia.
- [ ] **4.5** Editor de campaña con React Email (bloques) + envío de prueba.
- [ ] **4.6** Programación de envío y troceado en lotes vía Inngest (respetar límites
      y ventana horaria).
- [ ] **4.7** Gestión de bajas: página pública de unsubscribe + cabecera
      `List-Unsubscribe` + comprobación de `suppressions` antes de enviar.
- [ ] **4.8** Webhooks de Resend: entregas, aperturas, clics, rebotes, quejas →
      `email_events` y actualización de `marketing_status`.
- [ ] **4.9** Panel de resultados de campaña (enviados/abiertos/clics/rebotes/bajas).
- [ ] **4.10** Consentimiento/origen y pie RGPD con datos del remitente.

### Criterios de aceptación
- Creas un segmento, diseñas una campaña, envías una prueba, programas el envío real,
  el destinatario puede darse de baja y ves las métricas. Nadie de la lista de
  supresión recibe nada. Desplegado.

---

## FASE 5 · Secuencias / Drip

**Objetivo:** inscribir contactos en secuencias multi-paso con esperas, condiciones y
parada automática al responder. El diferenciador frente a Pipedrive Campaigns.

### Tareas
- [ ] **5.1** Migración: `sequences`, `sequence_steps`, `enrollments`.
- [ ] **5.2** Constructor de secuencias: pasos email/espera/condición/tarea, orden,
      días de espera, canal (Gmail 1:1 o Resend).
- [ ] **5.3** Workflow duradero en Inngest: ejecutar pasos con `step.sleep` (esperas
      de días) y `waitForEvent` (esperar respuesta/apertura).
- [ ] **5.4** Inscripción manual (desde un contacto o un filtro/segmento).
- [ ] **5.5** Parada automática al responder/rebote/baja (`stop on reply`).
- [ ] **5.6** Límite diario por buzón y ventana de envío aplicados a las secuencias.
- [ ] **5.7** Variantes A/B por paso de email.
- [ ] **5.8** Panel de la secuencia: inscritos, paso actual, tasas de apertura/
      respuesta, bajas.

### Criterios de aceptación
- Inscribes contactos en una secuencia de 3 pasos (email → espera 3 días → si no
  respondió, email 2). Al responder uno, su secuencia se detiene sola. Desplegado.

---

## FASE 6 · Motor de automatizaciones

**Objetivo:** constructor visual de automatizaciones (disparador → condiciones →
esperas → acciones) más potente que la lista lineal de Pipedrive.

### Tareas
- [ ] **6.1** Migración: `automations`, `automation_runs`.
- [ ] **6.2** Canvas visual de nodos (disparador, condición if/else, espera, acción).
- [ ] **6.3** Disparadores: registro creado/actualizado/borrado, cambio de etapa,
      cambio de campo, email abierto/respondido, formulario enviado, programado.
- [ ] **6.4** Sistema de eventos interno: las mutaciones emiten eventos a Inngest.
- [ ] **6.5** Acciones: crear/actualizar registro, enviar email, inscribir en
      secuencia, crear actividad, añadir etiqueta, mover de etapa, webhook, Slack.
- [ ] **6.6** Condiciones (if/else) y esperas reales sobre Inngest.
- [ ] **6.7** Registro de ejecuciones (`automation_runs`) con el detalle de pasos.
- [ ] **6.8** Activar/pausar automatizaciones y pruebas en seco (dry-run).

### Criterios de aceptación
- Construyes: "negocio pasa a etapa X → enviar email → esperar 3 días → si no hay
  respuesta, crear tarea". Se ejecuta y lo ves en el registro. Desplegado.

---

## FASE 7 · Captación (formularios web)

**Objetivo:** formularios embebibles que capturan leads directamente en el CRM
(equivalente gratis al LeadBooster de Pipedrive).

### Tareas
- [ ] **7.1** Migración: `forms`, `form_submissions`, `leads`.
- [ ] **7.2** Constructor de formularios (campos, mapeo a persona/negocio).
- [ ] **7.3** Página pública del formulario + script/iframe embebible.
- [ ] **7.4** Endpoint de recepción: crea/encuentra persona, crea lead, dispara
      automatización opcional.
- [ ] **7.5** Bandeja de leads: calificar, marcar basura, convertir a negocio.
- [ ] **7.6** Anti-spam (honeypot / rate limit) en el endpoint público.

### Criterios de aceptación
- Embebes un formulario en una web de prueba, lo envías y aparece el lead en el CRM,
  con la automatización disparada. Desplegado.

---

## FASE 8 · IA integrada (Claude)

**Objetivo:** IA útil en todo el flujo con la Claude API. El gran diferenciador.

### Tareas
- [ ] **8.1** Integrar `@anthropic-ai/sdk`; servicio de IA con control de coste y
      `ai_runs`.
- [ ] **8.2** Redacción y respuesta de correos asistida (en tu tono).
- [ ] **8.3** Resumen del historial de contacto/negocio.
- [ ] **8.4** Crear secuencias/automatizaciones por lenguaje natural.
- [ ] **8.5** Lead scoring automático (`persons.score`/`leads.score`).
- [ ] **8.6** Siguiente mejor acción por negocio (`deals.next_best_action`).
- [ ] **8.7** Análisis de sentimiento de respuestas entrantes.

### Criterios de aceptación
- En una ficha, la IA redacta un email y resume el historial; describes una secuencia
  en una frase y se genera. Coste registrado en `ai_runs`. Desplegado.

---

## FASE 9 · Analítica y reporting

**Objetivo:** paneles e informes para entender el negocio.

### Tareas
- [ ] **9.1** Dashboard principal (Tremor/Recharts): pipeline, previsión, actividad.
- [ ] **9.2** Embudo de conversión por etapa y tasa de victoria.
- [ ] **9.3** Rendimiento de email (aperturas/clics/respuestas/bajas).
- [ ] **9.4** Métricas de secuencias y campañas.
- [ ] **9.5** Objetivos (goals) y seguimiento.
- [ ] **9.6** Informes personalizados con filtros y exportación.

### Criterios de aceptación
- Un dashboard muestra estado del pipeline, previsión y rendimiento de email de un
  vistazo. Desplegado.

---

## FASE 10 · Extras y pulido

**Objetivo:** funcionalidades premium de Pipedrive (incluidas aquí) y refinamiento.

### Tareas
- [ ] **10.1** Documentos y firma electrónica (Smart Docs equivalente).
- [ ] **10.2** Productos y presupuestos (líneas de negocio, PDF).
- [ ] **10.3** PWA: instalable y responsive en móvil.
- [ ] **10.4** Copias de seguridad / exportación completa programada.
- [ ] **10.5** Optimización de hora de envío por contacto.
- [ ] **10.6** Canal extra: WhatsApp/SMS (opcional).
- [ ] **10.7** Auditoría de seguridad y rendimiento; tests e2e de los flujos críticos.

### Criterios de aceptación
- Las funciones premium de Pipedrive están cubiertas o conscientemente descartadas;
  la app es sólida, rápida y usable en móvil.

---

## Checklist transversal (en TODAS las fases)
- [ ] Validación con Zod en cada Server Action.
- [ ] Sin errores de TypeScript ni de `pnpm build`.
- [ ] Secretos solo en variables de entorno (nunca en el repo).
- [ ] RGPD: respetar supresión/consentimiento en cualquier envío.
- [ ] Commit por tarea + `ESTADO-ACTUAL.md` actualizado.
- [ ] Cada fase, desplegada en Vercel antes de pasar a la siguiente.
