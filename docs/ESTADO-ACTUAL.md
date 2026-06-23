# ESTADO ACTUAL · (archivo vivo)

> **Este es el primer archivo que se lee al retomar el proyecto.** Indica exactamente
> dónde estamos y qué hacer a continuación. Se actualiza al final de cada sesión y
> al terminar cada tarea.

---

## 📍 Dónde estamos

- **Fase 6 · Motor de automatizaciones:** **en curso.** **6.1** hecha: migración
  `0009_lively_sunspot` con `automations` (estado, `trigger_type` denormalizado +
  `trigger` JSONB, `graph` JSONB de nodos/aristas, `version`, `settings`) y
  `automation_runs` (estado running/waiting/completed/failed/cancelled, entidad
  disparadora, `trigger_event`/`context`/`log` JSONB, tiempos). Esquema en
  `src/server/db/schema/automations.ts` (con tipos de disparadores/nodos para 6.2–6.5).

- **Fase 5 · Secuencias / Drip:** **completa (5.1–5.8).**
  - **5.8** panel de la secuencia: página `/sequences/[id]` con métricas (inscritos,
    activos, completados, respondieron, pausados, emails enviados, aperturas, clics,
    bajas, rebotes), **tasas** sobre los emails enviados (apertura/clic/respuesta/
    rebote/baja), **desglose A/B por variante** (enviados/aperturas/clics por variante,
    con tasas) en los pasos con prueba A/B, y tabla de **inscritos** (estado, paso
    actual, fechas, motivo de parada). Query `getSequencePanel`/`getSequencePanelForOwner`
    (métricas desde `email_events.meta.sequence`, opens/clics únicos por
    enrollment+step). Enlace "Ver panel" y título enlazable en cada tarjeta.
  - **5.7** variantes A/B por paso de email: el paso base es la "Variante A" (peso 1) y
    `sequence_steps.variants` guarda alternativas B/C/D con peso, asunto y cuerpo (HTML
    saneado igual que el base). El constructor (`EmailStepFields` → `EmailVariantsEditor`)
    permite añadir/editar/quitar hasta 3 alternativas con su peso y editor rico. El
    runner (`resolveEmailVariant`/`pickWeightedVariant`) elige ponderadamente por
    inscripción, guarda la asignación en `enrollments.context.variantAssignments`
    (estable ante reintentos) y envía el contenido elegido; `variantId` viaja en la
    metadata Gmail y en los tags de Resend (base para las métricas por variante de 5.8).
  - **5.6** límite diario y ventana de envío aplicados a las secuencias: módulo
    compartido `src/lib/send-window.ts` (lógica pura de ventana con zona horaria,
    extraída de campañas para reutilizar en ambos). El workflow `run-sequence` consulta
    `gateSequenceEmailSend` antes de cada paso de email: si está fuera de la ventana
    horaria de la secuencia espera (`step.sleepUntil`) a su apertura; si se agotó el
    `dailyLimit` de la secuencia (contado por eventos `sent` etiquetados, en su zona),
    espera a la apertura del día siguiente; si no, envía. El límite del buzón Gmail
    sigue aplicándose en su servicio. `campaign-dispatch` ahora usa el módulo común
    (`isWithinSendWindow`/`nextAllowedSendAt`).
  - **5.5** parada automática (`stop on reply`): nueva función Inngest
    `stop-sequence-on-signal` (en `/api/inngest`) que escucha `sequence/signal.received`
    y detiene la inscripción **activa** ante respuesta/rebote/baja, en cualquier punto
    del flujo (incluida una espera), no solo en pasos de condición.
    `stopEnrollmentOnSignal` respeta `stop_on_reply` y `settings.stopOnBounce`/
    `stopOnUnsubscribe` (por defecto `true`); aperturas y clics nunca detienen. La
    actualización es idempotente (solo afecta a `status='active'`) y owner-aware. Marca
    `status` (replied/bounced/unsubscribed), `stopReason`, `stoppedAt` y limpia
    `nextRunAt`. Cuando el workflow despierta de un `step.sleep`, `loadSequenceRun`
    devuelve noop y no envía el siguiente paso.
  - **5.4** inscripción manual lista: `enrollInSequence` valida con Zod,
    autorización owner-aware y secuencia activa con pasos; permite inscribir un
    contacto individual o toda la audiencia de un segmento/filtro, deduplica por
    `sequence_id + person_id`, excluye contactos sin email, no suscritos o en
    `suppressions`, crea inscripciones activas con `next_run_at` inmediato y encola
    `sequence/run.requested` en Inngest. La UI permite inscribir desde `/sequences`,
    desde la ficha de contacto y desde tarjetas de `/segments`, con resumen de
    inscritos/omitidos.
  - **5.3** workflow duradero en Inngest: nueva función `run-sequence` registrada en
    `/api/inngest`, disparada por `sequence/run.requested`. Ejecuta pasos en orden con
    `step.run`, esperas con `step.sleep`, condiciones con `waitForEvent` y consulta
    previa de `email_events` para no perder señales que lleguen durante una espera.
    El runner carga inscripciones owner-aware, personaliza emails con merge tags,
    envía por Gmail 1:1 o Resend según el paso, crea tareas con su retraso configurado,
    avanza/completa inscripciones y marca fallos no reintentables. Aperturas/clics de
    Gmail, respuestas detectadas por sync y webhooks de Resend con `tags.type=sequence`
    emiten `sequence/signal.received` y guardan metadata de secuencia en `email_events`.
  - **5.2** constructor de secuencias: `/sequences` deja de ser placeholder y muestra
    un listado real con estado, canal, límites, ventana horaria, métricas de
    inscripciones y preview de pasos. El editor crea/actualiza secuencias con pasos
    email/espera/condición/tarea, reordenación, canal por paso de email, plantillas,
    merge tags, editor rico Tiptap, parada al responder, límite diario y ventana de
    envío. Las Server Actions validan con Zod, sanitizan HTML, preservan IDs de pasos
    existentes al reordenar/editar y bloquean el borrado si hay inscripciones activas.
  - **5.1** migración `0008_flowery_peter_parker` aplicada con `sequences`,
    `sequence_steps` y `enrollments`. El esquema está en
    `src/server/db/schema/sequences.ts` y cubre estados draft/active/paused/archived,
    canal Gmail 1:1 o Resend, límite diario, ventana horaria, parada al responder,
    pasos email/espera/condición/tarea con plantilla o cuerpo inline, variantes A/B,
    inscripción por contacto con paso actual, `next_run_at`, `inngest_run_id`, último
    mensaje, errores/reintentos y estados de parada por respuesta, rebote, baja o fallo.
- **Fase 4 · Campañas masivas (Resend):** **implementación completa (4.2–4.10 hechas; 4.1 queda como acción externa del usuario).**
  - **4.10** consentimiento/origen y pie RGPD: el editor de campañas guarda
    `settings.compliance` con nombre legal, dirección postal, email de contacto,
    política de privacidad, base legal y explicación de origen/consentimiento. La UI
    marca "RGPD pendiente" si falta algo; el servidor bloquea prueba/envío/programación
    hasta completar los datos. El pie final incluye remitente, dirección, contacto,
    política de privacidad, base legal, origen del contacto (`persons.source`) y baja
    personalizada. `SETUP.md` documenta defaults por entorno.
  - **4.9** panel de resultados de campaña: `/campaigns/[id]` muestra un detalle
    owner-aware con estado, asunto, segmento, remitente, métricas de audiencia,
    enviados, entregados, aperturas, clics, rebotes, quejas, bajas, suprimidos y
    fallidos. Las tasas principales se calculan desde los destinatarios reales y el
    panel lista destinatarios y eventos recientes de Resend filtrados por
    `email_events.meta.campaignId`. `/campaigns` enlaza cada tarjeta con "Resultados".
  - **4.8** webhooks de Resend: `/api/webhooks/resend` recibe eventos públicos sin
    login, valida la firma Svix con `RESEND_WEBHOOK_SECRET` sobre el cuerpo crudo,
    procesa eventos de envío, entrega, apertura, clic, rebote, queja, supresión,
    fallo y retraso, y guarda cada webhook en `email_events` con idempotencia por
    `svix-id`. Los eventos actualizan `campaign_recipients` sin degradar estados si
    llegan desordenados; rebotes/quejas/supresiones añaden `suppressions`, actualizan
    `marketing_status` del contacto y refrescan `campaigns.stats`.
  - **4.7** bajas de campañas: cada email real de campaña añade cabeceras
    `List-Unsubscribe`/`List-Unsubscribe-Post`, un enlace visible de baja y URLs
    firmadas por destinatario. `/unsubscribe/[token]` muestra una página pública de
    confirmación sin login y `/api/campaigns/unsubscribe/[token]` acepta POST one-click.
    Al confirmar, se actualiza `campaign_recipients` (`unsubscribed_at`), se crea/actualiza
    `suppressions`, se marca el contacto como `marketing_status=unsubscribed`, se registra
    `email_events.unsubscribe` y se refrescan métricas. `proxy.ts` deja públicas esas rutas.
  - **4.6** programación y envío real por lotes: `scheduleCampaign`,
    `sendCampaignNow` y `cancelScheduledCampaign` encolan `campaign/send.requested`
    con Inngest; `sendCampaign` espera la fecha programada, respeta ventana horaria y
    pausa entre lotes. El servicio `campaign-dispatch.ts` prepara audiencia de segmento
    en el momento del envío, deduplica por email, excluye contactos no suscritos y
    `suppressions`, personaliza merge tags por destinatario, envía con Resend batch +
    idempotency key por lote y actualiza `campaign_recipients`, `campaigns.stats`,
    `scheduled_at`/`sent_at`/estado. `/campaigns` muestra programación, acciones
    Enviar ahora/Programar/Cancelar y métricas básicas.
  - **4.5** editor de campañas: `/campaigns` deja de ser placeholder y muestra una
    pantalla real de borradores. Incluye editor con bloques React Email (texto
    enriquecido reutilizando `RichEmailEditor`, título, botón y separador), inserción de
    merge tags en asunto/preheader/cuerpo, selector de segmento con audiencia, preview
    HTML renderizada en servidor (`renderCampaignEmail`) y envío de prueba por Resend
    (`sendCampaignTest`) con degradación clara si falta `RESEND_API_KEY` o remitente. Los
    bloques se guardan en `campaigns.settings` y el HTML/texto de plantilla conserva las
    variables para que 4.6 pueda personalizar por destinatario.
  - **4.4** constructor de segmentos: catálogo de filtros `src/lib/segments.ts`
    (nombre, email, cargo, origen, estado de marketing, etiqueta, empresa y fecha de
    alta, con operadores por campo), resolutor de audiencia `queries/segments.ts`
    (reusa `ilike`/`inArray`/`isNull` de la Fase 1; cuenta total/con email/alcanzables),
    acciones CRUD + `previewSegmentAudience` (`actions/segments.ts`), página `/segments`
    y constructor (`SegmentFormDialog`) con reglas dinámicas (todas/cualquiera) y
    **previsualización del tamaño de audiencia en vivo**. Nuevo ítem "Segmentos" en la
    navegación. Verificado vía login de desarrollo (audiencia 10/10/10 coincide con un
    conteo independiente; ramas SQL de enum/etiqueta/fecha/empresa sin errores).
  - **4.2** migración `0007_typical_kat_farrell` con `segments` (audiencias
    dinámicas/estáticas, `definition` JSONB), `campaigns` (estado, proveedor Resend,
    plantilla, segmento, `stats` JSONB), `campaign_recipients` (estado por destinatario,
    message id de Resend, marcas de tiempo de entrega/apertura/clic/rebote/baja, único
    por campaña+email) y `suppressions` (lista de supresión RGPD por dueño, único por
    dueño+email). Esquema en `src/server/db/schema/marketing.ts`.
  - **4.3** servicio Resend `src/server/services/resend.ts` (transporte): envío
    individual (`/emails`, con `Idempotency-Key`) y por lotes (`/emails/batch`, troceo
    automático en grupos de 100), detección de configuración (`isResendConfigured`),
    remitente por defecto (`CAMPAIGN_FROM_EMAIL`/`NAME`), errores tipados
    (`ResendServiceError`) y degradación elegante sin `RESEND_API_KEY`. **No** consulta
    la BD: el filtrado RGPD (`suppressions`) se aplica en la orquestación 4.6 antes
    de llamar al servicio; 4.7 añade baja pública firmada y cabeceras `List-Unsubscribe`.
  - **Pendiente del usuario:** 4.1 (cuenta Resend + verificar dominio SPF/DKIM/DMARC) —
    ver "Siguiente paso" y `SETUP.md` §6.
- **Fase 0 · Fundaciones:** completa (queda solo el despliegue opcional). Login con
  Google verificado por el usuario ("funciona").
- **Fase 3 · Email 1:1 (Gmail):** **completa** (3.1–3.10). OAuth de
  Google pide `gmail.send` + `gmail.readonly`, con acceso offline e incremental;
  Auth.js conserva/actualiza tokens y scopes en `account`; `/inbox` muestra el
  estado seguro de conexión Gmail sin exponer tokens. Migración `0006_exotic_prism`
  aplicada con `mailboxes`, `email_threads`, `email_messages`, `email_templates` y
  `email_events`. Servicio Gmail de envío listo: refresca access tokens, construye
  MIME RFC 2822/base64url, envía por `users.messages.send`, respeta hilo Gmail y
  persiste hilo/mensaje/evento. Sincronización de entrada lista: job Inngest cada 10
  min, acción manual en `/inbox`, full sync inicial, incremental por Gmail History API
  y vínculo de mensajes entrantes a contacto/empresa por email. **3.5**: panel
  "Conversaciones" en fichas (contacto/empresa/negocio) y vista de conversación
  `/inbox/[threadId]` (mensajes cronológicos, Enviado/Recibido, cuerpo HTML→texto
  seguro). **3.6**: redactor Tiptap reutilizable, plantillas en Ajustes, merge tags de
  campos de serie y personalizados (contacto + empresa), fallback
  `{{nombre|"amigo"}}`, vista previa por destinatario y sanitización HTML en servidor.
  **3.7**: tracking propio de aperturas y clics; cada email saliente guarda
  `tracking_id`, añade pixel, reescribe enlaces HTTP/HTTPS a redirects firmados,
  registra eventos `open`/`click` y muestra contadores en la vista de hilo. **3.8**:
  `/inbox` ya es una bandeja unificada con lista de hilos, búsqueda, filtros de
  lectura/vinculación, ordenación y acceso a cada conversación. **3.9**: al sincronizar,
  un entrante que responde a un saliente del hilo (match por `In-Reply-To`/`References`,
  con fallback al último saliente sin responder) marca `replied_at`, registra evento
  `reply` y muestra "Respondido" en la conversación. **3.10**: el envío respeta el
  límite diario del buzón (reset a medianoche UTC) y añade la **firma HTML**; ajustes en
  **Ajustes → Correo (Gmail)** (límite, firma saneada, uso de hoy). **Fase 3 cerrada.**
- **Fase 2 · Pipeline/Negocios:** **completa** — **Kanban operativo** (dnd-kit) con
  embudos múltiples, etapas configurables en Ajustes, totales por columna, previsión
  ponderada, estancado, ganado/perdido, **ficha de negocio** (`/deals/[id]`) con
  tareas, notas y **participantes**, y **vista de lista** (`/deals?view=list`) con
  búsqueda, filtros por embudo/etapa/estado, ordenación y acciones por fila.
  Migraciones `0004` (pipeline) y `0005` (`deal_id` en actividades/notas).
- **Fase 1 · Contactos y Empresas:** **completa** y verificada (vía login de
  desarrollo). Para subir adjuntos hace falta activar Supabase Storage (`SETUP.md`).
  - Tablas CRM (migración `0001`) con índices y relaciones.
  - **Contactos:** listado con búsqueda, crear/editar (diálogo), borrar (reversible),
    ficha con detalles + línea de tiempo + notas, **etiquetas con color y filtro**.
  - **Empresas:** listado, crear/editar/borrar, ficha con sus contactos, notas y tareas.
  - **Actividades/tareas (1.10):** página `/activities` con filtros (Hoy/Pendientes/
    Hechas/Todas) y contadores, crear/editar/completar/borrar (estado optimista),
    tipos con icono, vencimientos con formato relativo y resaltado de vencidas,
    **panel de tareas en las fichas** de contacto y empresa, y **agenda de hoy** +
    stats reales en el panel principal. Acción rápida en ⌘K.
  - **Importación CSV/Excel (1.13):** asistente en `/contacts/import` (subir →
    mapear → vista previa → resultado), auto-mapeo de cabeceras (sin acentos),
    creación de empresas al vuelo, **dedupe por email** (omitir/actualizar, dentro
    del archivo y contra la BD) y validación por fila. Excel con `read-excel-file`,
    CSV con `papaparse`. Botón "Importar" y ⌘K.
  - **Exportación CSV (1.14):** contactos y empresas a CSV (botón "Exportar"),
    respetando los filtros activos, con BOM UTF-8 para acentos en Excel
    (`/api/contacts/export`, `/api/organizations/export`).
  - **Campos personalizados (1.8):** motor definido por el usuario (texto, número,
    monetario, fecha, sí/no, selección, selección múltiple, URL) en contactos y
    empresas. Gestión en **Ajustes**, render dinámico en **fichas y formularios**,
    valores en `custom_fields` (JSONB), **mapeo en la importación** y **columnas en la
    exportación**. Añadido **`trade_name` (nombre comercial)** de serie en empresas.
  - **Vistas guardadas (1.5):** barra de vistas en Contactos para guardar/aplicar/
    borrar combinaciones de filtros (búsqueda + etiqueta + **orden**). Tabla
    `saved_views`.
  - **Adjuntos (1.12):** tabla `files` + Supabase Storage. Panel "Archivos" en las
    fichas (subir hasta 10 MB, descargar con enlace firmado, borrar) con bucket
    privado y degradación elegante si Storage no está configurado.
  - **Front pulido (nivel profesional):** paleta de comandos **⌘K**, skeletons de
    carga (`loading.tsx`), página 404 cuidada, chips de etiquetas, microinteracciones.
  - Dashboard con contadores reales (contactos, empresas, tareas hoy, vencidas).
    `activity_log` registra las mutaciones (incluidas las de actividades).
  - **Login de desarrollo** `GET /api/dev-login` (solo dev) para probar sin Google.
  - Datos de ejemplo: `pnpm db:seed` (4 empresas, 10 contactos, 3 etiquetas,
    5 actividades).
- **Compila:** `pnpm typecheck` ✅, `pnpm lint` ✅ y `pnpm build` ✅. Verificado
  vía login de desarrollo (listados, fichas, creación de notas, Kanban y lista de
  negocios con filtros).
- **Repo:** git, varios commits. Sin remoto en GitHub todavía.

## ⏭️ Siguiente paso concreto

**Siguiente tarea de desarrollo:** **6.2** Canvas visual de nodos (disparador →
condición if/else → espera → acción) sobre el `graph` JSONB ya definido. Después: 6.3
disparadores, 6.4 sistema de eventos interno (las mutaciones emiten eventos a Inngest),
6.5 acciones, 6.6 condiciones/esperas, 6.7 registro de ejecuciones, 6.8 activar/pausar +
dry-run. Reutiliza Inngest (ya hay workflows de campañas y secuencias) y el patrón de
eventos `*/signal.received`.

**Pendiente externo:** 4.1 — API key de Resend **ya pegada** por el usuario; falta
verificar dominio (no tiene aún) para enviar a terceros; en local se prueba con
`onboarding@resend.dev` al propio correo. Métricas/bajas requieren despliegue (aplazado).

**Pendiente externo de Fase 4:** **4.1** (acción del usuario): crear cuenta en Resend y
verificar el dominio de envío (SPF/DKIM/DMARC). Guía completa en `SETUP.md` §6. Pasos:
- Crear cuenta en https://resend.com y un **API key** → ponerlo en `.env.local` como
  `RESEND_API_KEY`.
- **Domains → Add Domain** con el dominio de envío (p. ej. `mg.tudominio.com` o el
  dominio raíz). Resend da varios registros DNS:
  - **SPF/MX** (un `MX` para el subdominio de bounce + un `TXT` `v=spf1 include:...`).
  - **DKIM** (registro `TXT`/`CNAME` con la clave pública).
  - **DMARC** (opcional pero recomendado): `TXT` en `_dmarc.tudominio.com` con
    `v=DMARC1; p=none; rua=mailto:tu@correo`.
- Añadir esos registros en el DNS del dominio y pulsar **Verify** en Resend hasta que
  quede "Verified". Definir también `CAMPAIGN_FROM_EMAIL` (un `from` de ese dominio).

> Reutiliza lo ya hecho: el **motor de merge tags** (`lib/email/merge-tags.ts`) y el
> **modelo de email** de la Fase 3. La supresión (`suppressions`) debe comprobarse
> antes de cualquier envío (RGPD).

Tareas opcionales que quedaron fuera de la Fase 1 (retomar cuando convenga):
- Columnas y **filtros por campo personalizado** en los listados (sobre las vistas
  guardadas). Etiquetas también en empresas; editor de notas enriquecido (Tiptap).

> **Para activar adjuntos:** crear el bucket `attachments` y añadir
> `SUPABASE_SERVICE_ROLE_KEY` (ver `SETUP.md` §2 ter).

> **Hecho en la última sesión:** **Fase 6.1** (migración del motor de automatizaciones)
> y cierre de la **Fase 5** — 5.8 (panel de la secuencia), 5.7 (variantes A/B), 5.6
> (límite diario + ventana) y 5.5 (parada automática), más el commit de la 5.4
> (inscripción manual). Antes: 5.3
> (workflow duradero de secuencias), 5.2 (constructor de secuencias), 5.1 (migración de
> secuencias, pasos e inscripciones), 4.10 (consentimiento/origen y pie RGPD con datos
> del remitente), 4.9 (panel de resultados), 4.8 (webhooks de Resend), 4.7 (baja pública
> firmada), 4.6 (programación/envío real por lotes vía Inngest), 4.5 (editor),
> 4.2 (migración), 4.3 (Resend) y 4.4 (segmentos).

> **Cómo probar sin Google:** `pnpm dev`, abre http://localhost:3000/api/dev-login
> (entra como usuario de prueba) o usa el enlace "Entrar como desarrollador" en
> `/login`. Solo funciona en local.

> Seguridad: las credenciales se pegaron en el chat. Conviene **rotar** la contraseña
> de Supabase y el secreto de Google.

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

### 2026-06-23 (42) — Fase 6.1: migración del motor de automatizaciones
- **Esquema** `src/server/db/schema/automations.ts` con dos tablas:
  - `automations`: `status` (draft/active/paused/archived), `trigger_type`
    (denormalizado e indexado para localizar automatizaciones por evento en la 6.4),
    `trigger` JSONB (tipo + config), `graph` JSONB (`nodes`/`edges` del canvas de la
    6.2), `version` y `settings`. Tipos exportados de disparadores
    (record_created/updated/deleted, deal_stage_changed, field_changed, email_opened/
    replied, form_submitted, sequence_enrolled, scheduled) y de nodos
    (trigger/condition/wait/action) para construir 6.2–6.5.
  - `automation_runs`: `status` (running/waiting/completed/failed/cancelled),
    `automation_version`, `trigger_type`, entidad disparadora (`entity_type`/`entity_id`),
    `trigger_event`/`context`/`log` JSONB y tiempos (`started_at`/`finished_at`).
- **Migración** `drizzle/0009_lively_sunspot.sql` generada y **aplicada**; verificadas
  las dos tablas por BD con script `tsx` temporal (borrado). De paso, limpiado un
  `export * from "./sequences"` duplicado en el índice de esquema.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.
- **Nota de entorno:** se eliminó un `next dev` zombie (PID 32960) que dejaba el puerto
  ocupado; no era un fallo de código.

### 2026-06-21 (41) — Fase 5.8: panel de la secuencia (cierra la Fase 5)
- **Query** `getSequencePanel`/`getSequencePanelForOwner`: resumen de inscripciones por
  estado (incl. `paused`), métricas de email desde `email_events.meta.sequence`
  (enviados, aperturas/clics **únicos por enrollment+step**, respuestas únicas por
  enrollment, rebotes, bajas), desglose por variante A/B (sent/open/click por
  `variantId`, base = `stepId`) y lista de inscritos (persona, estado, paso actual,
  fechas, motivo de parada) con límite y conteo total.
- **UI** `/sequences/[id]`: cabecera con estado/canal/ventana, mosaico de métricas,
  tarjeta de **tasas** (sobre emails enviados), tarjeta de **Variantes A/B** por paso
  con tabla por variante y % de apertura/clic, y tabla de **Inscritos** enlazada a las
  fichas. Acceso desde la tarjeta de secuencia ("Ver panel" + título enlazable).
- **Verificado** con script `tsx` temporal (borrado): con 2 inscritos (1 activo, 1
  respondió) y eventos sembrados, el panel devuelve summary (total 2/activo 1/replied
  1), métricas (sent 2, opened 2, clicked 1, replied 1) y desglose A/B correcto
  (base 1/1/0, variante B 1/1/1). Confirmado que no quedan datos de prueba.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde. **Fase 5 completa.**

### 2026-06-21 (40) — Fase 5.7: variantes A/B por paso de email
- **Modelo:** el paso de email es la "Variante A" (peso 1 implícito);
  `sequence_steps.variants` guarda las alternativas (B/C/D) con `id`, `weight`,
  `subject`, `bodyHtml`/`bodyText`. Validación `sequenceVariantSchema` (máx. 3
  alternativas, cada una con asunto y contenido). HTML de variante saneado igual que el
  base al guardar.
- **Constructor:** `EmailVariantsEditor` en el editor de secuencias — añadir/editar/
  quitar variantes con peso, asunto y editor rico Tiptap; errores por variante.
- **Runner:** `pickWeightedVariant` (selección ponderada) + `resolveEmailVariant`
  (reutiliza la asignación previa de la inscripción o elige una nueva). La asignación se
  guarda en `enrollments.context.variantAssignments` (estable ante reintentos) y el
  contenido elegido se envía; `variantId` viaja en la metadata Gmail y en los tags de
  Resend para el desglose por variante (5.8). `loadSequenceRun` ahora carga `variants` y
  las asignaciones.
- **Verificado** con script `tsx` temporal (borrado): selección por peso (A:1/B:3 →
  ~24%/76%), reutilización estable de asignación, asignación obsoleta re-elige, y
  `loadSequenceRun` devuelve variantes + asignaciones desde la BD. Render de `/sequences`
  comprobado vía build (la ruta compila y la query carga `variants`).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-21 (39) — Fase 5.6: límite diario y ventana en secuencias
- **Módulo compartido** `src/lib/send-window.ts`: lógica pura de ventana de envío con
  zona horaria (`isWithinSendWindow`, `nextAllowedSendAt`, `nextDayWindowOpen`,
  `startOfLocalDayUtc`). Se extrajo de `campaign-dispatch` (que ahora la importa) para
  reutilizarla en campañas y secuencias sin duplicar.
- **Runner de secuencias:** `getSequenceEmailSendDecision` + `gateSequenceEmailSend`
  deciden, antes de cada paso de email, si enviar o esperar: fuera de la ventana de la
  secuencia → `step.sleepUntil` a su apertura; `dailyLimit` de la secuencia agotado
  (contado por eventos `sent` con `meta.sequence.sequenceId` desde la medianoche local)
  → espera a la apertura del día siguiente; si no, envía. El cupo del buzón Gmail se
  sigue aplicando en su servicio (segunda capa).
- **Verificado** con script `tsx` temporal (borrado): funciones de ventana en
  `Europe/Madrid` (dentro/fuera, próxima apertura hoy/mañana, inicio de día y apertura
  del día siguiente en CEST) y la decisión (ventana cerrada→wait window, cupo
  agotado→wait daily_limit, bajo cupo→send contando eventos por metadata de secuencia).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-21 (38) — Fase 5.5: parada automática (stop on reply/bounce/baja)
- **Handler global de señales:** nueva función Inngest `stop-sequence-on-signal`
  (registrada en `/api/inngest`) que escucha `sequence/signal.received` y, además del
  `waitForEvent` de los pasos de condición, detiene la inscripción **en cualquier punto
  del flujo** (incluida una espera o una secuencia sin condiciones).
- **`stopEnrollmentOnSignal`** (en `sequence-runner.ts`): owner-aware e idempotente
  (solo actúa sobre `status='active'`). Detiene si `reply` y `stop_on_reply`, o si
  `bounce`/`unsubscribe` y `settings.stopOnBounce`/`stopOnUnsubscribe` (por defecto
  `true`). Aperturas/clics nunca detienen. Marca `status`
  (replied/bounced/unsubscribed), `stopReason`, `stoppedAt` y limpia `nextRunAt`; el
  workflow, al despertar de un `step.sleep`, recarga y hace noop sin enviar el siguiente
  paso. Añadido `parseSequenceSignal` para reconstruir el payload del evento.
- **Verificado** con script `tsx` temporal (borrado) contra la BD: reply→replied
  (idempotente: 2.ª vez `already_replied`), `stop_on_reply=false` no detiene,
  bounce por defecto→bounced, `stopOnBounce=false` no detiene, open→noop y
  aislamiento por propietario (owner ajeno → `not_found`).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-21 (37) — Fase 5.4: inscripción manual de secuencias
- **Server Action:** `enrollInSequence` inscribe contactos con validación Zod,
  ownership por usuario y guardas de secuencia activa con pasos. Acepta origen
  `person` o `segment`, resuelve la audiencia del segmento con el motor de filtros,
  limita inscripciones manuales masivas a 5.000 contactos y deduplica contra
  inscripciones existentes.
- **RGPD/lista de supresión:** antes de crear inscripciones se normaliza el email y se
  omiten contactos sin email, no suscritos (`marketing_status != subscribed`) o presentes
  en `suppressions`; el resultado muestra solicitados, inscritos, encolados y motivos de
  omisión.
- **Inngest:** cada inscripción nueva se crea activa con `next_run_at` inmediato y se
  encola en lote como `sequence/run.requested`; si el encolado falla, se revierte la
  inserción recién creada para no dejar contactos parados.
- **UI:** nuevo diálogo reutilizable para inscribir en secuencias desde `/sequences`,
  desde la ficha de contacto y desde tarjetas de `/segments`, con contacto/segmento
  bloqueado cuando el contexto ya lo da y resumen posterior de la operación.
- **Verificado:** `pnpm typecheck` y `pnpm lint` en verde; validación `tsx` de
  `sequenceEnrollmentSchema`; login de desarrollo + fetch DOM de `/sequences`,
  `/contacts/[id]` y `/segments` con segmento temporal creado y eliminado para comprobar
  que la acción aparece en la superficie real.
- **Siguiente:** 5.5 parada automática al responder/rebote/baja (`stop on reply`).

### 2026-06-21 (36) — Fase 5.3: workflow duradero de secuencias
- **Inngest:** nueva función `run-sequence`, registrada junto al resto de funciones,
  para ejecutar inscripciones por evento `sequence/run.requested`. Cada paso crítico
  va en `step.run`; las esperas usan `step.sleep`; las condiciones esperan
  `sequence/signal.received` con `waitForEvent`.
- **Runner:** `sequence-runner.ts` carga la inscripción activa, valida secuencia/contacto,
  respeta supresión y `marketing_status`, personaliza con merge tags, envía emails por
  Gmail 1:1 o Resend, crea tareas con retraso, avanza/completa inscripciones y marca
  errores no reintentables sin duplicar envíos dentro del workflow.
- **Señales:** aperturas/clics Gmail, respuestas detectadas por Gmail Sync y webhooks de
  Resend con `tags.type=sequence` guardan metadata de secuencia en `email_events` y
  emiten señales `open`/`click`/`reply`/`bounce`/`unsubscribe` para las condiciones.
- **Robustez:** antes de esperar una condición se consulta `email_events`, evitando
  perder eventos que llegasen durante una espera previa. Las emisiones desde tracking y
  sync son best-effort para no romper pixel, redirect ni sincronización.
- **Verificado:** script temporal `tsx` con alias CLI de `server-only` validó helpers,
  carga real de una secuencia temporal con 3 pasos, inscripción activa y detección de
  señal persistida. `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.
- **Siguiente:** 5.4 inscripción manual desde contacto o filtro/segmento.

### 2026-06-21 (35) — Fase 5.2: constructor de secuencias
- **UI real:** `/sequences` sustituye el placeholder por listado de secuencias, tarjetas
  con estado, canal, pasos, inscripciones, límite diario, ventana horaria y acciones.
- **Constructor:** diálogo profesional para crear/editar secuencias con configuración
  general, parada al responder, límite diario, ventana de envío y zona horaria.
- **Pasos:** editor reordenable para email, espera, condición y tarea. Los pasos de email
  soportan canal Gmail 1:1/Resend, plantillas, asunto, preheader, editor rico Tiptap y
  merge tags; las esperas guardan días/horas; las condiciones guardan tipo/valor; las
  tareas guardan asunto, notas y retraso.
- **Datos:** `queries/sequences.ts` carga secuencias owner-aware con pasos e
  inscripciones agregadas. `actions/sequences.ts` valida con Zod, sanitiza HTML, guarda
  pasos en transacción, preserva IDs de pasos existentes al editar/reordenar y bloquea
  eliminar secuencias con inscripciones activas.
- **Verificado:** DOM de `/sequences` vía login de desarrollo (200, título y acción
  renderizados, sin placeholder) y script temporal de BD con secuencia + 4 pasos
  email/espera/condición/tarea, limpiando datos al terminar. `pnpm typecheck`,
  `pnpm lint` y `pnpm build` en verde.
- **Siguiente:** 5.3 workflow duradero en Inngest.

### 2026-06-21 (34) — Fase 5.1: migración de secuencias
- **Esquema:** nuevo `src/server/db/schema/sequences.ts` con `sequences`,
  `sequence_steps` y `enrollments`, exportado desde el punto único de esquema.
- **Secuencias:** estado `draft`/`active`/`paused`/`archived`, canal Gmail 1:1 o Resend,
  parada al responder, límite diario, ventana horaria, zona horaria y `settings` JSONB.
- **Pasos:** orden por `position`, tipos email/espera/condición/tarea, espera en días y
  horas, plantilla o cuerpo inline, `condition` JSONB, variantes A/B y settings por paso.
- **Inscripciones:** contacto inscrito con vínculos opcionales a empresa/negocio, paso
  actual, `next_run_at`, `inngest_run_id`, último mensaje, errores/reintentos y estados
  para completado, pausado, respondido, rebotado, baja o fallo.
- **Migración:** `drizzle/0008_flowery_peter_parker.sql` generada y aplicada con
  `pnpm db:generate` + `pnpm db:migrate`.
- **Docs:** roadmap marcado en 5.1 y modelo de datos actualizado. Siguiente tarea: 5.2
  constructor de secuencias.
- **Verificado:** `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-21 (33) — Fase 4.10: consentimiento/origen y pie RGPD
- **Modelo sin migración:** cada campaña guarda `settings.compliance` con nombre legal,
  dirección postal, email de contacto, URL de privacidad, base legal y texto de
  origen/consentimiento.
- **Editor:** `/campaigns` añade una sección "RGPD y datos del remitente"; las tarjetas
  muestran "RGPD pendiente" si faltan datos y el envío/programación/prueba se bloquean
  en servidor hasta completarlos.
- **Pie final:** los emails reales de campaña incluyen base legal, explicación de
  consentimiento, origen del contacto (`persons.source`), datos del remitente, política
  de privacidad y enlace personal de baja. Las pruebas incluyen el pie legal sin enlace
  real de baja.
- **Defaults:** `SETUP.md` documenta variables `CAMPAIGN_LEGAL_*`,
  `CAMPAIGN_CONTACT_EMAIL`, `CAMPAIGN_PRIVACY_URL`, `CAMPAIGN_CONSENT_BASIS` y
  `CAMPAIGN_CONSENT_NOTICE`.
- **Resultados:** `/campaigns/[id]` muestra también el snapshot legal de la campaña.
- **Verificado:** prueba HTTP con login de desarrollo y campaña temporal con datos RGPD;
  listado + detalle renderizaron los datos legales. Datos temporales eliminados.
  `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-21 (32) — Fase 4.9: panel de resultados de campaña
- **Detalle de resultados:** nueva ruta `/campaigns/[id]` con cabecera de campaña,
  estado, segmento, fechas, remitente, preheader y proveedor.
- **Métricas completas:** tarjetas para audiencia, enviados, entregados, aperturas,
  clics, rebotes, quejas, bajas, suprimidos y fallidos; tasas de entrega, apertura,
  clic, rebote, baja y queja con barras de lectura rápida.
- **Datos reales:** `getCampaignResults` filtra por `ownerId`, calcula contadores desde
  `campaign_recipients` para no depender de métricas JSON obsoletas y lee eventos de
  Resend desde `email_events.meta.campaignId`.
- **Tablas operativas:** listado de destinatarios con estado y marcas temporales, y
  eventos recientes con tipo, destinatario, URL/ID de proveedor y fecha.
- **Navegación:** las tarjetas de `/campaigns` enlazan al panel mediante el botón
  "Resultados".
- **Verificado:** prueba HTTP con login de desarrollo: campaña temporal con
  destinatarios/eventos renderizó listado + detalle; datos y scripts temporales
  eliminados. `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-21 (31) — Fase 4.8: webhooks de Resend
- **Ruta pública:** `/api/webhooks/resend` queda fuera del proxy de login y responde
  JSON sin caché. Lee `request.text()` para conservar el cuerpo crudo requerido por la
  firma.
- **Firma:** verificación compatible con Svix (`svix-id`, `svix-timestamp`,
  `svix-signature`) usando `RESEND_WEBHOOK_SECRET`, tolerancia temporal y comparación
  constante.
- **Validación:** payloads de Resend parseados con Zod; se soportan `email.sent`,
  `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
  `email.complained`, `email.suppressed`, `email.failed` y `email.delivery_delayed`.
- **Persistencia idempotente:** cada webhook se guarda en `email_events` con
  `provider_event_id=resend:<svix-id>` y `onConflictDoNothing`; el estado del
  destinatario se actualiza sin degradar eventos fuera de orden.
- **RGPD/entregabilidad:** rebotes, quejas y supresiones crean/actualizan
  `suppressions`, marcan el contacto como `bounced`/`complained` y refrescan métricas
  de campaña.
- **Setup:** `docs/SETUP.md` documenta la URL del webhook, eventos a seleccionar y
  `RESEND_WEBHOOK_SECRET`.
- **Verificado:** script temporal `tsx` (borrado) contra `next start` con payload
  `email.bounced` firmado: primer POST `processed`, segundo POST `duplicate`, evento
  único, destinatario `bounced`, contacto `bounced`, supresión creada y métricas
  actualizadas. `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-21 (30) — Fase 4.7: bajas públicas de campañas
- **Tokens firmados:** `campaign-unsubscribe.ts` genera enlaces duraderos por
  destinatario con HMAC (`AUTH_SECRET`) y verifica payload campaña/destinatario/email.
- **Cabeceras y pie:** el envío real de campañas añade `List-Unsubscribe`,
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` y un enlace visible de baja al
  HTML/texto de cada email.
- **Rutas públicas:** `/unsubscribe/[token]` muestra confirmación sin sesión;
  `/api/campaigns/unsubscribe/[token]` acepta POST para one-click y formulario humano.
  `proxy.ts` permite ambas rutas sin redirigir a `/login`.
- **Persistencia:** al confirmar, se marca el destinatario como `unsubscribed`, se
  rellena `unsubscribed_at`, se crea/actualiza `suppressions`, se marca el contacto como
  `marketing_status=unsubscribed`, se inserta `email_events.unsubscribe` y se refrescan
  métricas con `campaign-stats.ts`.
- **Verificado:** rutas públicas sin cookie no redirigen a login; token inválido muestra
  página/POST de error controlado. `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-20 (29) — Fase 4.6: programación y envío por lotes
- **Orquestación Inngest:** nueva función `sendCampaign` para el evento
  `campaign/send.requested`; espera `scheduled_at`, respeta ventana horaria
  configurable (`CAMPAIGN_SEND_WINDOW_START/END`, zona horaria) y pausa entre lotes.
- **Servicio de dispatch:** `src/server/services/campaign-dispatch.ts` prepara la
  audiencia al enviar, deduplica por email, filtra contactos no suscritos y
  `suppressions`, personaliza merge tags por destinatario, manda por `sendResendBatch`
  con idempotencia por lote y finaliza estado/métricas.
- **Acciones/UI:** `scheduleCampaign`, `sendCampaignNow` y `cancelScheduledCampaign`;
  `/campaigns` muestra estado programado/en curso/enviado, métricas básicas y botones
  Enviar ahora/Programar/Cancelar.
- **Datos auxiliares:** queries owner-aware para segmentos y campos personalizados, y
  `CampaignStats.suppressed` para reflejar destinatarios excluidos.
- **Verificado:** `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde. Dev-login +
  `GET /campaigns` renderiza HTML autenticado sin runtime/build error.

### 2026-06-20 (28) — Fase 4.5: editor de campañas
- **Dependencias:** añadidos `@react-email/components` y `@react-email/render` para
  renderizar emails de campaña en servidor.
- **Modelo de editor:** `src/lib/campaign-blocks.ts` y
  `src/lib/validations/campaign.ts` definen bloques (texto enriquecido, título, botón,
  separador), validación Zod, URLs seguras y comprobación de contenido.
- **Render React Email:** `src/server/services/campaign-email.tsx` genera HTML/texto
  con React Email, conserva merge tags al guardar plantilla y los sustituye solo en modo
  personalizado (prueba/envío futuro), escapando valores dentro de HTML enriquecido.
- **Acciones/queries:** `src/server/actions/campaigns.ts` permite previsualizar,
  guardar/editar/borrar borradores con autorización por dueño y enviar prueba por Resend;
  `src/server/queries/campaigns.ts` lista campañas y defaults de remitente sin exponer
  secretos.
- **UI:** `/campaigns` deja de ser placeholder. Nueva `CampaignsView` con lista de
  borradores, diálogo de edición, selector de segmento con audiencia, `RichEmailEditor`,
  menú de merge tags, reordenado de bloques, preview HTML en iframe y envío de prueba.
  La navegación ya muestra "Campañas" como sección activa, sin "próximamente".
- **Verificado** con login de desarrollo leyendo DOM en `http://127.0.0.1:3100/campaigns`:
  status 200, contiene "Campañas" y "Nueva campaña", y no renderiza el placeholder.
  `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-20 (27) — Fase 4.4: constructor de segmentos
- **Catálogo de filtros** `src/lib/segments.ts` (agnóstico): campos sobre `persons`
  (nombre, email, cargo, origen, estado de marketing, etiqueta, empresa, fecha de alta)
  con sus operadores (`contains`/`eq`/`is_set`/`has_label`/`before`/`after`…), helpers
  (`isRuleComplete`, `describeRule`, `defaultRuleForField`) y tipos `SegmentDefinition`/
  `SegmentRule` reutilizados por el esquema `marketing.ts`.
- **Resolutor** `src/server/queries/segments.ts`: traduce las reglas a SQL reutilizando
  las primitivas de la Fase 1 (`ilike`/`inArray`/`isNull`); `countSegmentAudience`
  (total / con email / alcanzables = con email y suscrito) y `resolveSegmentPersons`
  (base de un envío, con `reachableOnly`). CRUD `listSegments`/`getSegment` +
  `listSegmentOptions`.
- **Acciones** `src/server/actions/segments.ts`: crear/editar/borrar (autorización por
  dueño, nombre único con mensaje claro) y `previewSegmentAudience` para el constructor.
  Validación Zod en `src/lib/validations/segment.ts`.
- **UI:** página `/segments`, `SegmentsView` (tarjetas con resumen de reglas y
  audiencia) y `SegmentFormDialog` (constructor de reglas todas/cualquiera con
  **previsualización del tamaño de audiencia en vivo**, debounce). Ítem "Segmentos" en
  la navegación.
- **Verificado** vía login de desarrollo (lectura de DOM): la página renderiza el
  segmento sembrado, el resumen de reglas y la audiencia **10/10/10**, que coincide con
  un conteo independiente; una definición compuesta (enum, etiqueta con subconsulta,
  fecha y empresa) renderiza sin errores. Segmento de prueba limpiado.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-20 (26) — Fase 4.3: servicio Resend (transporte)
- **Servicio** `src/server/services/resend.ts`: capa de transporte para campañas.
  - `sendResendEmail` (POST `/emails`, con `Idempotency-Key` opcional para reintentos).
  - `sendResendBatch` (POST `/emails/batch`, troceo automático en grupos de 100; los
    resultados conservan el orden de entrada y los fallos por trozo se marcan por
    elemento; 401/403/429 cortan el envío).
  - `isResendConfigured`/`getResendApiKey` (degradación elegante sin `RESEND_API_KEY`),
    `getDefaultCampaignFrom` (`CAMPAIGN_FROM_EMAIL`/`CAMPAIGN_FROM_NAME`), `formatFrom`
    (sanea el nombre del remitente) y `ResendServiceError` con códigos
    (`not_configured`/`invalid_input`/`rate_limited`/`api_error`).
  - **RGPD:** el servicio NO consulta la BD; el filtrado por `suppressions` se hará en
    la orquestación de la campaña (4.6/4.7) **antes** de llamar aquí.
- **Docs:** `SETUP.md` §6 con los pasos de Resend (API key, verificación de dominio
  SPF/DKIM/DMARC, `CAMPAIGN_FROM_EMAIL/NAME`).
- **Verificado** con script `tsx` temporal (borrado): sin clave, `isResendConfigured()`
  es `false`, `sendResendEmail` rechaza con `not_configured` (no envía nada), la
  validación de lote marca fallidos sin tocar la red, y `formatFrom` sanea
  comillas/`<>`. `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-20 (25) — Fase 4.2: migración de campañas
- **Esquema** `src/server/db/schema/marketing.ts` con cuatro tablas:
  - `segments` (audiencias): `kind` (dynamic/static), `definition` JSONB (reglas de
    filtro de la Fase 1 / ids estáticos), único por dueño+nombre.
  - `campaigns`: asunto, `from_name`/`from_email`/`reply_to`, `provider` (resend),
    `status` (draft/scheduled/sending/sent/paused/failed), `template_id` (→
    `email_templates`), cuerpo HTML/texto, `segment_id`, `scheduled_at`/`sent_at`,
    `stats` y `settings` JSONB.
  - `campaign_recipients`: estado por destinatario
    (pending/sent/delivered/opened/clicked/bounced/complained/unsubscribed/suppressed/
    failed), `provider_message_id` de Resend, marcas de tiempo de cada evento, único por
    campaña+email normalizado.
  - `suppressions` (RGPD): `reason` (unsubscribe/bounce/complaint/manual), `source`,
    único por dueño+email normalizado; se comprobará antes de cada envío.
- **Migración** `drizzle/0007_typical_kat_farrell.sql` generada y **aplicada**
  (`pnpm db:migrate`). Verificado por BD (las 4 tablas existen) con script `tsx`
  temporal (borrado).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-19 (24) — Fase 3.10: límite diario + firma HTML (Fase 3 cerrada)
- **Firma HTML** del buzón añadida al final de cada email enviado (HTML + texto) en
  `gmail.ts`, tras `prepareSend` y antes del tracking.
- **Ajustes del buzón:** query `getMailboxSettings` (límite, firma, uso de hoy con
  reset a medianoche), action `updateMailboxSettings` (sanea la firma con
  `sanitizeEmailHtml`), validación `mailbox.ts` y panel **Ajustes → Correo (Gmail)**
  (`MailboxSettings`). El **límite diario** ya lo aplicaba el servicio de envío (Codex).
- **Verificado** vía login de desarrollo: el panel renderiza (uso, límite, firma) y el
  guardado persiste (límite 75 + firma saneada `<p>…<br />…</p>`); buzón restaurado a
  valores por defecto tras la prueba. El envío real (con firma) lo prueba el usuario al
  conectar Gmail.
- Build, typecheck y lint en verde. **Fase 3 completa.**

### 2026-06-19 (23) — Fase 3.9: detección de respuestas
- **Relevo desde Codex:** verificados los gates tras el handoff (typecheck/lint/build
  en verde).
- **Detección de respuestas** en `gmail-sync`: al insertar un mensaje entrante,
  `markRepliesForInbound` busca los salientes del hilo que coincidan por
  `In-Reply-To`/`References` (normalizando `<id>`), con fallback al último saliente sin
  responder; marca `email_messages.replied_at`, inserta un evento `reply` idempotente y
  un apunte `email_replied` en `activity_log`. `GmailSyncResult` ahora cuenta `replies`.
- **UI:** la conversación (`/inbox/[threadId]`) muestra "Respondido · fecha" en los
  salientes con `replied_at`.
- **Verificado** vía login de desarrollo (hilo sembrado): el saliente respondido marca
  "Respondido" y el entrante no. La detección en vivo corre durante la sync de Gmail
  (requiere conexión del usuario). Datos de prueba limpiados.

### 2026-06-19 (22) — Fase 3.8: bandeja unificada de ventas
- **Datos:** `listInboxThreads` carga todos los hilos del usuario con ownership,
  buzón, último mensaje, contacto/empresa/negocio vinculado y contadores de estado.
- **Filtros:** `/inbox` soporta búsqueda por asunto/snippet/buzón/contacto/empresa/
  negocio, filtro por todos/no leídos/vinculados/sin vincular y orden reciente/antiguo.
- **UI:** `InboxThreadsView` muestra lista responsive de conversaciones, estado de
  lectura, remitente/destinatario, snippet, fecha, número de mensajes y chips de
  vinculación CRM. La lista queda como experiencia principal cuando Gmail está listo.
- **Verificado:** login de desarrollo + lectura HTML de `/inbox` y
  `/inbox?filter=unread&q=Sugar` devuelven 200 y contienen conversaciones
  sincronizadas, búsqueda y enlaces a `/inbox/[threadId]`.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-19 (21) — Bugfix: sincronización Gmail tras activar API
- **Causa:** la Gmail API ya respondía OK, pero la sync fallaba al actualizar hilos
  porque `postgres-js` no serializa `Date` dentro de fragmentos raw de Drizzle
  (`sql`).
- **Fix:** `gmail-sync.ts` castea `received_at` como ISO `::timestamptz` en los
  `greatest(coalesce(...))` de `last_message_at`/`last_inbound_at`.
- **UX:** `Sincronizar ahora` ya no muestra overlay rojo para errores esperados de
  Gmail (`GmailServiceError`); la página muestra el error guardado en el panel.
- Verificado que `https://gmail.googleapis.com/gmail/v1/users/me/profile` responde
  `200` para la cuenta conectada y que `pnpm typecheck`, `pnpm lint` y `pnpm build`
  siguen en verde.

### 2026-06-19 (20) — Fase 3.7: tracking de aperturas y clics
- **Instrumentación:** cada email saliente recibe un `tracking_id`, se envía con pixel
  propio de apertura y los enlaces HTTP/HTTPS se reescriben a redirects firmados.
- **Seguridad:** las URLs de clic se firman con HMAC usando `AUTH_SECRET`; el endpoint
  rechaza firmas inválidas y no actúa como redirect abierto. El HTML de email permite
  enlaces seguros (`http`, `https`, `mailto`, `tel`) y descarta enlaces relativos.
- **Eventos:** `/api/email/track/open/[trackingId]` registra `open`; `/api/email/track/click/[trackingId]`
  registra `click`, IP, user-agent y URL destino en `email_events`, además de
  actualizar `open_count`/`click_count`, `opened_at`/`clicked_at` en `email_messages`.
- **UI:** el editor Tiptap permite añadir/quitar enlaces; `/inbox/[threadId]` muestra
  aperturas, clics y primera fecha registrada en cada mensaje enviado.
- **Setup:** `docs/SETUP.md` documenta que en producción hay que definir
  `NEXT_PUBLIC_APP_URL` para que Gmail pueda cargar el pixel/redirección públicos.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-19 (19) — Fase 3.6: redactor Tiptap, plantillas y merge tags
- **Editor:** `RichEmailEditor` con Tiptap (`immediatelyRender: false` para Next),
  toolbar con iconos, placeholder y HTML básico para emails 1:1.
- **Personalización:** motor compartido de merge tags con campos de serie y
  personalizados de contacto/empresa, fallback (`{{nombre|"amigo"}}`), detección de
  variables desconocidas y escapado de valores en HTML.
- **Plantillas:** gestión en Ajustes (crear/editar/eliminar) con el mismo editor rico
  y menú de variables; se guardan `body_html`, `body_text` y variables usadas.
- **Envío:** botón "Enviar email" en fichas de contacto, empresa y negocio; selector y
  vista previa por destinatario, plantillas aplicables y vínculo a contacto/empresa/
  negocio al enviar.
- **Seguridad:** sanitización server-side del HTML permitido antes de guardar
  plantillas y antes de llamar al servicio Gmail.
- **Verificado** vía login de desarrollo leyendo DOM: Ajustes muestra "Plantillas de
  email" y las fichas de contacto, empresa y negocio muestran el botón de email.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-18 (18) — Fase 3.5: vista de hilo de conversación
- **Relevo desde Codex:** verificados los gates tras el handoff (typecheck, lint —ahora
  a cero, Codex limpió los 2 errores preexistentes— y build); actualizada la nota de
  gates en `AGENTS.md`.
- **Datos:** `queries/email-threads.ts` — `listEntityThreads({person|org|deal})` y
  `getThreadWithMessages` (mensajes en orden cronológico).
- **UI:** `EmailThreadsPanel` (panel "Conversaciones") en las fichas de contacto,
  empresa y negocio; página `/inbox/[threadId]` con la conversación (Enviado/Recibido,
  remitente, fecha, destinatarios), cuerpo `bodyText` o **HTML→texto** (sin XSS).
- **Verificado** vía login de desarrollo (hilo sembrado): panel en la ficha y
  conversación con 2 mensajes en orden y dirección correctos. Datos de prueba limpiados.
- Build, typecheck y lint en verde.

### 2026-06-18 (17) — Fase 3.4: sincronización Gmail de entrada
- **Auth común:** `src/server/services/gmail-auth.ts` centraliza cuenta Google,
  comprobación de scopes Gmail, refresh de access token, estado `needs_reauth` y
  candidatos de sincronización.
- **Sync:** `src/server/services/gmail-sync.ts` implementa full sync inicial acotado,
  sync incremental con `users.history.list`, recuperación automática si el cursor
  caduca y obtención `messages.get?format=full`.
- **Persistencia:** los mensajes entrantes se guardan de forma idempotente en
  `email_threads`/`email_messages`, con headers, texto/HTML, adjuntos metadata,
  labels Gmail, eventos `sync`, activity log y actualización de `gmail_history_id`.
- **Vinculación:** los hilos entrantes se vinculan al contacto por `from.email`
  normalizado y heredan su empresa cuando existe.
- **Inngest/UI:** job `sync-gmail-mailboxes` cada 10 min + evento
  `gmail/sync.requested`; `/inbox` muestra estado de buzón, último sync, cursor/error
  y permite "Sincronizar ahora".
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-18 (16) — Fase 3.3: servicio Gmail de envío
- **MIME:** `src/lib/email/mime.ts` construye mensajes RFC 2822 con texto/HTML
  multipart, headers `Message-ID`, `In-Reply-To` y `References`, codificación UTF-8 y
  `raw` base64url para Gmail.
- **Validación:** `src/lib/validations/email.ts` valida destinatarios, asunto, cuerpo
  y vínculos opcionales a contacto/empresa/negocio/hilo.
- **Servicio:** `src/server/services/gmail.ts` usa tokens de Auth.js `account`,
  comprueba `gmail.send`, refresca access tokens vía `refresh_token`, asegura el
  `mailbox`, respeta límite diario, llama `users.messages.send` y persiste hilo,
  mensaje y evento `sent`.
- **Threading:** al responder a un hilo local, envía `threadId` de Gmail y headers
  `In-Reply-To`/`References`; bloquea asuntos incompatibles para no romper el hilo.
- **Server Action:** `sendEmail` en `src/server/actions/emails.ts`, con autorización
  por sesión y revalidación de superficies afectadas.
- **Verificado:** prueba local del MIME/base64url; no se envía correo real sin una
  cuenta Google reautorizada.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-18 (15) — Fase 3.2: modelo de email
- **Esquema:** nuevo `src/server/db/schema/email.ts` con `mailboxes`,
  `email_threads`, `email_messages`, `email_templates` y `email_events`, exportado
  desde el punto único de esquema.
- **Diseño:** tokens OAuth siguen en Auth.js `account`; `mailboxes` guarda metadatos,
  estado, límites de envío, firma y datos de sync (`gmail_history_id`,
  `last_synced_at`). Hilos y mensajes llevan `owner_id`, referencias a buzón,
  IDs Gmail/RFC, vínculos a contacto/empresa/negocio, tracking y metadatos JSONB.
- **Migración:** `drizzle/0006_exotic_prism.sql` generada con índices/uniques para
  owner, buzón, IDs de proveedor, contacto/negocio, fechas y tracking; aplicada con
  `pnpm db:migrate`.
- **Docs:** `docs/02-MODELO-DE-DATOS.md` actualizado para reflejar el modelo real de
  Fase 3 sin duplicar tokens sensibles en `mailboxes`.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-18 (14) — Fase 3.1: OAuth Gmail
- **OAuth:** scopes compartidos en `src/lib/google-oauth.ts` (`openid`, `email`,
  `profile`, `gmail.send`, `gmail.readonly`) con `access_type=offline`,
  `prompt=consent`, `include_granted_scopes=true` y `response_type=code`.
- **Auth.js:** Google Provider usa la configuración común y el callback `signIn`
  actualiza de forma conservadora `access_token`, `refresh_token`, `expires_at`,
  `token_type`, `scope` e `id_token` de la cuenta Google existente.
- **UI:** `/inbox` deja de ser placeholder y muestra estado de conexión Gmail,
  permisos concedidos/faltantes, refresh token, caducidad del access token y acción
  para conectar o reautorizar Gmail. La navegación ya no marca Bandeja como
  "próximamente".
- **Docs:** `docs/SETUP.md` documenta habilitar Gmail API, scopes requeridos y la
  nota de verificación OAuth en producción.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-18 (13) — Fase 2.10: vista de lista de negocios
- **Datos:** `listDeals` con filtros por embudo, etapa, estado y búsqueda por negocio/
  contacto/empresa; ordenación por recientes, antiguos, valor y cierre previsto.
- **UI:** `/deals?view=list` con conmutador Kanban/Lista, resumen de resultados,
  tabla responsive, filtros URL-driven, creación/edición con `DealFormDialog` y
  acciones por fila (ganar, perder con motivo, reabrir, eliminar).
- **Calidad:** corregidos avisos/errores de lint existentes (`ThemeToggle`,
  `useIsMobile` y `DealFormDialog`) para dejar `pnpm lint` verde completo.
- **Verificado** vía login de desarrollo con `curl`: `/deals`, `/deals?view=list` y
  `/deals?view=list&status=all&sort=value-desc&q=a` devuelven 200, renderizan los
  controles esperados y no muestran overlay de Next.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde. **Fase 2 cerrada.**

### 2026-06-18 (12) — Fase 2.7: participantes del negocio
- **Datos:** `getDeal` carga `contacts` (con persona); actions
  `addDealContact`/`removeDealContact` (autorización por dueño del negocio,
  `onConflictDoNothing`); validación `dealContactSchema`.
- **UI:** `DealParticipants` en la ficha del negocio — lista de personas con rol
  opcional, alta inline (selector de contacto + rol) y quitar. Usa la tabla
  `deal_contacts` (ya existente desde la migración `0004`).
- **Verificado** vía login de desarrollo: añadir y quitar participante end-to-end.
- Build, typecheck y lint (archivos nuevos) en verde.

### 2026-06-18 (11) — Fase 2.6: ficha de negocio
- **Migración `0005`:** `deal_id` en `activities` y `notes` (con índices y relaciones),
  para colgar tareas y notas de un negocio.
- **Datos:** `getDeal` (con etapa, embudo, contacto, empresa, actividades y notas);
  actividades (action/validación + `ActivityFormDialog`/`ActivitiesPanel`/
  `NewActivityButton`/`ActivityRow`) y notas (`createNote`/`NoteComposer`) admiten
  `dealId`.
- **UI:** página `/deals/[id]` (ficha de negocio) con detalles, panel de tareas y de
  notas, y `DealActions` (editar, ganado/perdido con motivo, reabrir, eliminar). Las
  tarjetas del Kanban enlazan a la ficha.
- **Verificado** vía login de desarrollo: render completo de la ficha y **alta de nota
  en el negocio end-to-end** (cableado `deal_id`). Datos de prueba limpiados.
- Build, typecheck y lint (archivos nuevos) en verde.

### 2026-06-18 (10) — Fase 2: tablero Kanban de negocios
- **Migración `0004`:** `pipelines`, `stages`, `deals`, `deal_contacts` (índices y
  relaciones). Valor en `double precision`, `stage_changed_at`, `position` para orden.
- **Datos:** `queries/deals.ts` (bootstrap de embudo por defecto, `getBoard` con
  agrupación por etapa + totales + previsión, opciones), `actions/deals.ts`
  (crear/editar/borrar, `moveDeal` con reordenación y `stage_changed_at`,
  ganado/perdido/reabrir) y `actions/pipelines.ts` (CRUD de embudos y etapas con
  guardas). Dependencia **@dnd-kit**.
- **UI:** `/deals` con **tablero Kanban** (arrastrar entre etapas, estado optimista),
  `DealFormDialog` (crear/editar), selector de embudo, creación rápida por columna,
  tarjetas con contacto/empresa, **indicador de estancado**, **totales por columna** y
  **previsión ponderada** en cabecera; diálogo de "perdido" con motivo.
  Gestión de **embudos y etapas en Ajustes** (`PipelinesManager`). Negocios en la
  navegación y en ⌘K. `formatMoney`/`formatMoneyCompact` en `lib/format`.
- **Seed** con 1 embudo, 4 etapas y 5 negocios de ejemplo.
- **Verificado** vía login de desarrollo: render del tablero, 5 negocios por etapas,
  totales (68.000 €), **previsión 31.400 €** (cálculo ponderado correcto), estancado,
  y gestión de embudos en Ajustes. El arrastre dnd no se prueba en headless.
- Build, typecheck y lint (archivos nuevos) en verde.

### 2026-06-18 (9) — Adjuntos (1.12) + cierre y revisión de la Fase 1
- **Migración `0003`** aplicada: tabla `files`.
- **Adjuntos (1.12):** helper `server/storage.ts` (Supabase Storage con `service_role`,
  URL deducida de `DATABASE_URL`, `isStorageConfigured()`), queries/actions, route
  handlers `POST /api/attachments` (subida multipart, máx. 10 MB, autorización por
  dueño de la entidad) y `GET /api/attachments/[id]` (descarga vía enlace firmado).
  `AttachmentsPanel` en fichas de contacto y empresa con **degradación elegante** si
  Storage no está configurado. Dependencia `@supabase/supabase-js`. Setup del bucket
  documentado en `SETUP.md` §2 ter.
- **Revisión en navegador de la Fase 1** (login de desarrollo, lectura de DOM + fetch):
  campos personalizados en Ajustes/fichas (texto y monetario `1.500.000,00 €`) y en
  export; `trade_name`; vistas guardadas (aplicar/limpiar) y orden por nombre; panel
  de adjuntos en estado "no configurado". Datos de prueba sembrados y limpiados.
- Build, typecheck y lint (archivos nuevos) en verde. **Fase 1 cerrada.**

### 2026-06-18 (8) — Campos personalizados + vistas guardadas (1.8 y 1.5)
- **Migración `0002`** aplicada: `custom_field_defs`, `saved_views` y `trade_name`
  en `organizations`.
- **Campos personalizados (1.8):** módulo compartido `lib/custom-fields.ts` (tipos,
  iconos, slugify, coerción y formateo de valores), validación, queries y actions
  (crear/editar/borrar/reordenar). Gestión en **Ajustes**
  (`custom-fields-manager.tsx`), sección dinámica de inputs en los formularios de
  contacto y empresa (`custom-fields-section.tsx`) y filas en las fichas
  (`custom-fields-list.tsx`). Valores en `custom_fields` (JSONB), saneados por tipo en
  las mutaciones. **`trade_name`** de serie en empresas (form, ficha, export).
  **Import** ampliado para mapear columnas a campos personalizados; **export** añade
  una columna por campo.
- **Vistas guardadas (1.5):** `saved_views` + validación/queries/actions. Barra de
  vistas en Contactos (`saved-views-bar.tsx`): guardar la combinación actual
  (búsqueda + etiqueta + **orden**), aplicarla con un clic y borrarla. Añadido
  selector de **orden** (recientes/antiguos/nombre) al listado de contactos.
- Los formularios de contacto/empresa se remontan al abrir (estado limpio sin
  efectos), evitando avisos de React.
- Seed con `trade_name` y 2 campos personalizados de ejemplo.
- Build, typecheck y lint (archivos nuevos) en verde. **Verificación en navegador
  aplazada** al cierre de la Fase 1 (tras 1.12), por indicación del usuario.

### 2026-06-17 (7) — Importación/exportación CSV-Excel (Fases 1.13 y 1.14)
- **Importación (1.13):** asistente `/contacts/import` de 4 pasos (subir → mapear →
  vista previa → resultado). Parseo en cliente: CSV con **papaparse**, Excel (.xlsx)
  con **read-excel-file/universal**. Auto-mapeo de cabeceras (minúsculas + sin
  acentos). Server action `importContacts` con validación Zod por fila, **dedupe por
  email** (dentro del archivo y contra la BD: omitir o actualizar), **creación de
  empresas al vuelo**, inserciones por lotes y registro en `activity_log`.
- **Exportación (1.14):** route handlers `GET /api/contacts/export` y
  `/api/organizations/export` con auth, respetando filtros (`q`/`label`), CSV
  RFC-4180 con **BOM UTF-8** (acentos en Excel) — utilidad `lib/csv.ts`. Botones
  "Importar"/"Exportar" en los listados y acción en ⌘K.
- **Dependencias:** `papaparse` (+ tipos) y `read-excel-file` (se evita el `xlsx` de
  npm por su CVE).
- **Verificado** vía login de desarrollo: exportación real (cabeceras, BOM a nivel de
  bytes, filtros) e **importación de extremo a extremo** inyectando un CSV (auto-mapeo,
  vista previa con estados, y escritura en BD: 2 creados, dedupe de existentes y
  duplicados del archivo, empresa creada al vuelo, errores por fila). Datos de prueba
  limpiados después.
- Build, typecheck y lint (archivos nuevos) en verde.

### 2026-06-17 (6) — Actividades/tareas (Fase 1.10)
- **Capa de datos:** `lib/activities.ts` (tipos con icono, formato de vencimientos),
  `lib/validations/activity.ts` (Zod), `server/queries/activities.ts` (listado con
  filtros, agenda y contadores) y `server/actions/activities.ts` (crear/editar/
  completar/borrar con autorización por propietario y registro en `activity_log`).
- **UI:** página `/activities` con pestañas Hoy/Pendientes/Hechas/Todas y contadores;
  `ActivityFormDialog` (react-hook-form + Zod, fecha en `datetime-local` convertida a
  ISO en el cliente), `ActivityRow` (completar con **estado optimista** vía
  `useOptimistic`, editar/borrar), `ActivitiesPanel` en fichas de contacto y empresa,
  `NewActivityButton`. **Agenda de hoy** y stats reales (tareas hoy/vencidas) en el
  panel. Ítem "Actividades" en la navegación y acción en ⌘K.
- **Fichas:** la cronología de la ficha de contacto pasa a ser **solo notas**; las
  empresas ganan paneles de **tareas y notas** (datos ya cargados en la query).
- Seed con 5 actividades de ejemplo (vencida, hoy, próximas, hecha).
- **Verificado** vía login de desarrollo leyendo el DOM: filtros, contadores, badges
  de vencimiento (vencida en rojo), agenda del panel y panel de tareas en la ficha.
- Build, typecheck y lint (de los archivos nuevos) en verde.

### 2026-06-16 (5) — Pulido premium + etiquetas
- **Paleta de comandos (⌘K)**: navegación y acciones rápidas (`command-menu.tsx`,
  integrada en el topbar).
- **Estados de carga**: `loading.tsx` con skeletons en listados/fichas/dashboard;
  `not-found.tsx` cuidado.
- **Etiquetas (Fase 1.9)**: queries/actions (`labels`), chips de color, selector en
  la ficha (crear/asignar/quitar) y **filtro por etiqueta** en el listado.
- Verificado vía login de desarrollo (chips se muestran en 6 contactos). Nota: las
  superposiciones Base UI (popover/paleta) no responden a clics sintéticos del
  navegador headless de la vista previa → usar `preview_eval` para leer estado.
- Build y typecheck en verde. Seed incluye 3 etiquetas de ejemplo.

### 2026-06-16 (4) — Revisión + Fase 1 (Contactos y Empresas)
- Revisión de seguridad/rendimiento → `docs/05-SEGURIDAD-Y-RENDIMIENTO.md`.
- Login de desarrollo `/api/dev-login` (solo dev) + enlace en `/login`.
- Esquema CRM (carpeta `schema/`: auth.ts + crm.ts) con índices y relaciones;
  migración `0001` aplicada (7 tablas).
- Capa de datos: validaciones Zod, queries y server actions (personas, empresas,
  notas) con autorización por propietario y registro en `activity_log`.
- UI Contactos y Empresas: listados con búsqueda, diálogos de crear/editar, borrado
  reversible, fichas con detalles/contactos/notas/timeline. Dashboard con contadores.
- `pnpm db:seed` con datos de ejemplo. Verificado end-to-end vía login de desarrollo.
- Pendiente Fase 1: etiquetas, actividades, CSV import/export, campos personalizados.

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
