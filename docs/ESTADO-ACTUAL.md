# ESTADO ACTUAL · (archivo vivo)

> **Este es el primer archivo que se lee al retomar el proyecto.** Indica exactamente
> dónde estamos y qué hacer a continuación. Se actualiza al final de cada sesión y
> al terminar cada tarea.

---

## 📍 Dónde estamos

- **Fase T · Transversal de comunicación comercial:** **completa (T.1–T.6) por decisión
  del usuario (2026-06-29).** Antes de seguir construyendo reporting, había que cerrar una
  experiencia profesional de comunicación: pantalla global para redactar/enviar emails
  desde el CRM, plantillas comerciales base, acciones CRM dentro de secuencias (incluido
  mover de etapa/embudo al avanzar un paso), preparación visible de Resend para contacto
  masivo y auditoría de entregabilidad/RGPD. La pantalla `/emails/compose` ya reutiliza
  el compositor real de Gmail 1:1 con plantillas, merge tags, preview, IA opcional,
  vínculo a negocio/hilo y redirección al hilo enviado. Las 5 plantillas comerciales
  base ya viven en `email_templates` con restauración idempotente desde Ajustes. **T.3**
  añade el paso **Acción CRM** en secuencias (mover de etapa/embudo creando la entrada si
  falta —toggle `createIfMissing`—, etiqueta, campo, tarea, inscribir/parar otra secuencia,
  notificar y webhook), con lógica reutilizable en `src/server/services/crm-actions.ts`.
  **T.4** añade el checklist **Preparación para envío masivo (Resend)** en `/campaigns`
  (`getResendReadiness` + `ResendChecklist`): requisitos (API key, remitente, RGPD) vs.
  recomendados (webhook, `NEXT_PUBLIC_APP_URL`), dominio como verificación manual, nº de
  supresiones y límites de lote/pausa/ventana; sin exponer secretos. **T.5** añade controles
  de escala: duplicar campañas/secuencias, preparación mínima por tarjeta antes de lanzar,
  prueba por variante de secuencia, pausa/reanudación segura y reintentos de fallidos con
  `delivery.runId` para idempotencia de Resend. **T.6** añade la auditoría transversal
  de entregabilidad/cumplimiento en `/campaigns`: Gmail 1:1, Resend masivo, RGPD,
  bajas/supresiones, rebotes/quejas y calentamiento, sin exponer secretos. Plan,
  plantilla y checklist operativo en `docs/08-EMAIL-RESEND-Y-REDACCION.md` y
  `docs/SETUP.md`.

- **Fase 9 · Analítica y reporting:** **COMPLETA (9.1–9.6).** `/analytics` muestra el
  dashboard principal con KPIs de negocio, previsión ponderada, snapshot del embudo,
  snapshot de rendimiento de email, snapshot de secuencias/campañas, actividad reciente
  y ganados por mes.
  `/analytics/funnel` añade el informe dedicado de conversión por etapa con selector de
  embudo, entradas históricas desde `deal_stage_events`, conversión completa y tasa de
  victoria por embudo. `/analytics/email` añade el informe transversal de email
  (aperturas/clics/respuestas/bajas) desde `email_events`, con conteos únicos, desglose
  por canal, actividad diaria, enlaces más clicados y señales recientes.
  `/analytics/outreach` añade métricas específicas de secuencias y campañas: KPIs,
  comparativa de canales, estados, tablas top enlazadas y variantes A/B. **9.5** añade
  `/analytics/goals`: objetivos medibles por periodo (ingresos, pipeline, actividad,
  comunicación) con progreso calculado desde los datos reales (tabla `goals`). **9.6** añade
  `/analytics/reports`: informe de negocios con filtros (estado, embudo, rango de fechas),
  agrupación (etapa/estado/mes/campaña) y exportación CSV. **Con esto la Fase 9 queda cerrada.**

- **Fase 8 · IA agnóstica:** **completa (8.1–8.7).** La base de IA ya no depende de un
  proveedor concreto: `ai_runs` está migrada, `src/server/ai` define `AIProvider`, el
  adaptador `openai-compatible` permite probar con Groq/Ollama/OpenRouter/etc., y
  `src/server/services/ai.ts` centraliza timeout, reintentos, salida estructurada con
  Zod/JSON Schema, coste estimado y degradación elegante. Están hechos: borradores de
  email, respuestas asistidas, resúmenes de historial, creación de secuencias/
  automatizaciones por lenguaje natural, lead scoring, siguiente mejor acción y análisis
  de sentimiento de respuestas entrantes.

- **Bloque prioritario de embudo/filtros (decisión de producto 2026-06-23):**
  **cerrado** y absorbido dentro de la Fase 6 (6.4a–6.4j hechas). Resumen del bloque:
  - **6.4a HECHA** `campaign` nativo en contactos: migración, validación, formulario,
    ficha, listado, exportación, segmentos, merge tags y auto-mapeo desde Excel/CSV. Es
    la campaña/origen comercial de carga del contacto; no es la tabla `campaigns` de
    emails masivos.
  - **6.4b HECHA** filtros por campo de contacto con operador **"comienza por"**:
    contrato URL validado, campos de serie (`campaign` incluido), empresa y campos
    personalizados; varias condiciones AND; UI tipo Pipedrive con chips, **Añadir
    condición**, buscador, sugerencias, categorías por entidad, **Limpiar** y vistas
    guardadas; export CSV y segmentos respetan el operador de prefijo.
  - **6.4c** embudo de **contactos/prospección** real: no basado en actividades. Los
    contactos importados deben entrar en la etapa inicial **"Cargadas"** y el tablero
    debe mostrar todos los contactos cargados, con movimiento manual entre etapas. Las
    actividades siguen siendo tareas/seguimientos, no el estado del embudo. Las tarjetas
    del tablero deben tener como título la empresa y debajo el nombre del contacto; si
    hay varios contactos de una empresa, aparecen varias tarjetas con la misma empresa.
    **DECISIÓN 2026-06-23:** se **convierte el tablero de Negocios** en este embudo
    (reutiliza `deals`+etapas+Kanban), NO se crea sección aparte. Detalle en memoria
    `embudo-de-contactos.md`. **HECHA (2026-06-23):** servicio
    `src/server/services/contact-funnel.ts` (`addContactToFunnel(Safely)`,
    `getDefaultFunnelEntry` = primera etapa "Cargadas", `backfillContactsIntoFunnel`,
    dedupe 1 tarjeta/contacto/embudo, título = empresa). Altas **manuales**
    (`createPerson`) e **importación** (`importContacts`) meten el contacto en "Cargadas"
    automáticamente. Tablero: tarjeta = empresa (título) + contacto debajo, **toda la
    tarjeta es arrastrable** (listeners en la raíz, clic simple sigue abriendo) y botón
    **"Cargar contactos"** (backfill). **Fix 2026-06-23:** el dedupe mira **cualquier
    embudo** (no solo el por defecto): "Cargar contactos" solo añade contactos que no
    estén ya en NINGÚN embudo.
  - **6.4d HECHA:** (a) **filtros 6.4b en Kanban y Lista** — `deals/page.tsx` decodifica
    el filtro, resuelve `personId` con `listPersonIdsByFilters` y acota
    `getBoard`/`listDeals` por `inArray(deals.personId, …)`; `ContactFiltersBar` con
    `basePath` se renderiza en ambas vistas. (b) **layout** — `min-w-0` en `SidebarInset`
    y `main` (scroll horizontal sin cortar la página) + selector de embudo acotado.
    Pendiente menor opcional: selector tipo combobox con buscador si crecen mucho los
    embudos.

- **Fase 6 · Motor de automatizaciones:** **completa (6.1–6.8 + 6.4a–6.4j).**
  - **6.7** registro de ejecuciones: query `listAutomationRuns` (owner-aware) y panel
    `AutomationRuns` ("Ejecuciones recientes") bajo el editor en `/automations/[id]`:
    estado del run, disparador, fechas, error y **log por nodo** (ok/skipped/failed con
    su mensaje). Render puro (sin cliente).
  - **6.6** condiciones y esperas reales: `executeAutomationRun` ya recorre el grafo por
    aristas, evalua nodos `condition` contra `payload.*`/`event.*`, campos de persona,
    empresa, negocio y `custom:*`, respeta ramas `true`/`false` y ejecuta nodos `wait`
    mediante `step.sleep` cuando viene desde Inngest. El builder guarda para cada
    condicion si la rama cumplida/no cumplida continua o detiene el flujo. Verificado con
    `tsx` contra BD real y limpieza QA: rama true condicion+espera+tarea, rama false stop.
  - **6.8** dry-run y activacion: activar/pausar ya esta en lista/editor y el editor
    añade **Guardar y probar en seco**. La prueba guarda la version actual, crea un
    `automation_run` visible con `context.dryRun`, evalua condiciones, simula esperas sin
    dormir y valida acciones sin efectos reales (sin tareas, etiquetas, movimientos,
    inscripciones ni webhooks). Verificado con `tsx`: dry-run con condicion+espera+tarea
    completo, `sleep` no llamado y 0 tareas creadas.
  - **6.4j** sincronía con el embudo: `/automations` añade **Plantilla de embudo** para
    crear en borrador flujos `deal_stage_changed(stageId)` → `create_task` o
    `enroll_sequence`, validando ownership de etapa/secuencia y abriendo el editor para
    revisar, probar en seco y activar. Verificado con `tsx` stubbeando sesión/revalidate:
    dos plantillas reales en BD con trigger/grafo correctos y limpieza QA.
  - **6.5** ejecución de acciones: `src/server/services/automation-executor.ts`
    (`executeAutomationRun`) procesa cada `automation_runs` en `waiting`, recorre el
    grafo y ejecuta los nodos de acción sobre la entidad disparadora, con log por nodo y
    estado final `completed`/`failed`. Acciones: `create_task`, `add_label`,
    `move_stage` (negocios), `update_field` (custom field), `enroll_sequence` (inscribe +
    emite `sequence/run.requested`), `webhook` (POST), `notify`, `send_email` y
    `ai_summary`. `send_email` envía una plantilla por Gmail con merge tags y
    degradación elegante si falta buzón/transporte; `ai_summary` resume el historial con
    la capa de IA y lo guarda como nota. Cableado en `run-automations-for-event` y
    reflejado en dry-run.
  - **6.4** sistema de eventos interno: `src/server/services/automation-runner.ts`
    define `AUTOMATION_EVENT` (`automation/event`), emisores best-effort hacia Inngest,
    normalización/parseo de eventos, `eventId` para deduplicar reintentos y
    `dispatchAutomationEvent`. La función Inngest `run-automations-for-event` ya está
    registrada en `/api/inngest`: busca automatizaciones activas con
    `findActiveAutomationsForEvent` y crea `automation_runs` en estado `waiting`, con
    snapshot del grafo, versión, contexto, `trigger_event` y log inicial. Las mutaciones
    de contactos, empresas y negocios emiten creado/actualizado/borrado y
    `field_changed`; negocios emite también `deal_stage_changed` al mover/cambiar etapa;
    las inscripciones de secuencia emiten `sequence_enrolled`; el tracking Gmail emite
    `email_opened` solo en la primera apertura; el sync Gmail emite `email_replied` al
    detectar respuestas. El embudo de contactos/prospección real quedó cerrado en
    6.4c–6.4j.
  - **6.3** disparadores: `src/server/services/automation-events.ts` define el evento
    interno (`AutomationEvent` = type/ownerId/entityType/entityId/payload),
    `triggerMatchesEvent` (matcher puro: tipo + filtros de entidad/etapa destino/campo) y
    `findActiveAutomationsForEvent` (owner-aware: automatizaciones **activas** cuyo
    disparador coincide). El catálogo/validación ya cubre registro creado/actualizado/
    borrado, cambio de etapa, cambio de campo, email abierto/respondido, formulario,
    secuencia y disparador programado. Es la base usada por el despachador de 6.4.
  - **6.2** constructor de flujos: catálogo `src/lib/automations.ts` (disparadores,
    tipos de nodo, acciones con su campo de config, operadores de condición, helpers),
    validación Zod (`automation.ts`), queries (`listAutomations`, `getAutomation`(+
    ForOwner), `listAutomationBuilderOptions`) y acciones (crear/editar/borrar,
    `setAutomationStatus`). UI: `/automations` (lista con estado/disparador/nº pasos,
    crear→editar, activar/pausar, eliminar) y editor `/automations/[id]`
    (`AutomationBuilder`): disparador configurable + nodos acción/espera/condición en
    secuencia, reordenables, con config por nodo (acciones con selects de
    plantilla/secuencia/etiqueta/etapa). Se guarda en `trigger`/`graph` (cadena lineal de
    aristas; las ramas if/else reales llegan en 6.6). Activar exige disparador. "Automatizaciones"
    ya no es "próximamente" en la navegación.
  - **6.1** hecha: migración
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
    CSV con `papaparse`. Botón "Importar" y ⌘K. **6.4a:** `campaign` ya es campo
    nativo de contacto y se auto-mapea desde Excel/CSV.
  - **Exportación CSV (1.14):** contactos y empresas a CSV (botón "Exportar"),
    respetando los filtros activos, con BOM UTF-8 para acentos en Excel
    (`/api/contacts/export`, `/api/organizations/export`).
  - **Campos personalizados (1.8):** motor definido por el usuario (texto, número,
    monetario, fecha, sí/no, selección, selección múltiple, URL) en contactos y
    empresas. Gestión en **Ajustes**, render dinámico en **fichas y formularios**,
    valores en `custom_fields` (JSONB), **mapeo en la importación** y **columnas en la
    exportación**. Añadido **`trade_name` (nombre comercial)** de serie en empresas.
    **6.4b:** contactos ya filtra por campo/prefijo, incluidos campos personalizados.
  - **Vistas guardadas (1.5):** barra de vistas en Contactos para guardar/aplicar/
    borrar combinaciones de filtros (búsqueda + etiqueta + **orden** + condiciones
    avanzadas de 6.4b). Tabla `saved_views`.
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

**Siguiente tarea de desarrollo:** **Fase 10 · Extras y pulido.** 10.1 (documentos y firma)
**HECHA**; siguiente **10.2 productos y presupuestos (PDF)**. Resto: 10.3 PWA/responsive,
10.3 PWA/responsive en móvil, 10.4 copias de seguridad programadas, 10.5 hora de envío
óptima por contacto, 10.6 WhatsApp/SMS (opcional) y 10.7 auditoría de seguridad/rendimiento
+ tests e2e de los flujos críticos.

**Resend para el usuario:** para enviar masivamente hace falta cuenta de Resend, dominio o
subdominio verificado con SPF/DKIM/MX/DMARC, `RESEND_API_KEY`, remitente del dominio
verificado, webhook `/api/webhooks/resend`, `RESEND_WEBHOOK_SECRET`, datos legales/RGPD y
`NEXT_PUBLIC_APP_URL` correcto en producción. Detalle en
`docs/08-EMAIL-RESEND-Y-REDACCION.md` y `docs/SETUP.md` §6.

**Nota de 7.4 (motor):** la automatización directa del formulario (`forms.automation_id`)
se ejecuta **en proceso** (esperas inmediatas, como el dry-run) solo si su disparador no
es `form_submitted` (para no duplicar con el evento). Si en el futuro se quieren esperas
reales también ahí, habría que encolarla como run duradero (Inngest) en vez de en proceso.

**6.4d HECHO (completo):**
- **Filtros 6.4b en Kanban y Lista:** `deals/page.tsx` decodifica el filtro
  (`decodeContactFilterParams`), resuelve los `personId` que cumplen
  (`listPersonIdsByFilters`, reutilizando el motor de 6.4b) y acota el tablero/lista con
  `inArray(deals.personId, …)` en `getBoard`/`listDeals`. `ContactFiltersBar` ahora
  acepta `basePath` y se renderiza en **ambas** vistas de `/deals`.
- **Layout:** `min-w-0` en `SidebarInset` y `main` (el Kanban hace scroll horizontal sin
  cortar la página con muchos embudos/etapas); selector de embudo acotado.

**(6.4c HECHA — referencia del plan que se siguió, Opción A · reutilizar `deals`):**

> **DECISIÓN DEL USUARIO (2026-06-23, confirmada con captura + pregunta):**
> **Convertir el tablero de Negocios (`/deals`) en el embudo de CONTACTOS.** NO crear
> una sección aparte. Cada tarjeta = **un contacto** (título = empresa, debajo el
> contacto). Reutilizar el modelo `deals`+`stages`+Kanban+arrastre+automatización
> `deal_stage_changed`. Ver memoria de Claude `embudo-de-contactos.md`.

Plan concreto para el relevo (Opción A · reutilizar `deals`):
1. **Modelo:** la posición de un contacto en el embudo = un `deal` con `personId`
   (+ `orgId`). No hace falta tabla nueva. (Opcional: columna `deals.kind`/`source`
   = `prospect` para distinguir de negocios manuales si se quieren conservar; el usuario
   acepta que los negocios manuales dejen de usarse así.)
2. **Etapas:** bootstrap idempotente del pipeline por defecto con las etapas del embudo
   (Cargadas → Contactadas → Follow-up 1/2/3 → Respuesta positiva → Respuesta negativa
   → Reunión agendada → Go!). Revisar `getBoard`/bootstrap actual en `queries/deals.ts`.
3. **Import → "Cargadas":** en `importContacts` (`actions/import-contacts.ts`), tras
   crear cada contacto nuevo, crear 1 `deal` en la 1.ª etapa del pipeline por defecto
   con `personId`+`orgId` y `title` = empresa (`trade_name`/`name`) o nombre del contacto.
   Evitar duplicados (un deal por persona en ese pipeline).
4. **Backfill:** acción + botón "Cargar contactos en el embudo" para crear deals de los
   contactos ya subidos que no tengan uno (los importados antes de este cambio).
5. **Tarjeta** (`components/deals/deals-board.tsx`): título = empresa
   (`trade_name`/`name`); 2.ª línea = nombre del contacto; sin empresa → título =
   contacto. Quitar/ocultar el valor monetario en este modo (es 0 €). Varios contactos
   de una empresa = varias tarjetas (sale solo, 1 deal por persona).
6. **Filtros:** reutilizar los filtros de 6.4b (campaign/empresa/contacto/campos pers.,
   operador "comienza por") en el tablero.
7. **Verificar:** importar contactos → aparecen en "Cargadas"; varios contactos de la
   misma empresa = varias tarjetas; arrastre entre etapas; gates en verde. Como el
   arrastre dnd-kit y los overlays no se prueban en headless, verificar el render (DOM)
   y la lógica de servidor con script `tsx` temporal (crear deals desde import) + BD.

Después: **6.4d** UX de Negocios con muchos funnels (selector/combobox escalable). Solo
al cerrar 6.4c–6.4d se retoma **6.5** acciones de automatización.

**Pendiente externo de Fase 4 / Resend:** si `RESEND_API_KEY` ya está en `.env.local`,
lo que falta para enviar a terceros con calidad es verificar un dominio o subdominio de
envío. En local se puede probar con remitente de prueba (`onboarding@resend.dev`) al propio
correo, pero no es el modo de producción. Guía completa en `SETUP.md` §6 y resumen:
- En Resend, **Domains → Add Domain** con el dominio de envío (p. ej.
  `mg.tudominio.com` o el dominio raíz).
- Añadir en el DNS los registros que indique Resend: SPF/MX de rebotes, DKIM y DMARC
  recomendado.
- Pulsar **Verify** hasta que quede "Verified".
- Definir `CAMPAIGN_FROM_EMAIL` con un remitente de ese dominio y `CAMPAIGN_FROM_NAME`.
- Para métricas reales y bajas, desplegar la app o exponer local con túnel y configurar
  el webhook `/api/webhooks/resend` + `RESEND_WEBHOOK_SECRET`.

> Reutiliza lo ya hecho: el **motor de merge tags** (`lib/email/merge-tags.ts`) y el
> **modelo de email** de la Fase 3. La supresión (`suppressions`) debe comprobarse
> antes de cualquier envío (RGPD).

Tareas opcionales que quedaron fuera de la Fase 1 (retomar cuando convenga):
- Etiquetas también en empresas; editor de notas enriquecido (Tiptap). Los filtros por
  campo/prefijo ya no son opcionales: están priorizados en 6.4b.

> **Para activar adjuntos:** crear el bucket `attachments` y añadir
> `SUPABASE_SERVICE_ROLE_KEY` (ver `SETUP.md` §2 ter).

> **Última decisión de producto (2026-06-29):** antes de seguir con analítica, cerrar una
> **fase transversal de comunicación comercial**: pantalla global de redacción, plantillas
> comerciales base, acciones CRM dentro de secuencias, preparación visible de Resend para
> envío masivo y auditoría de entregabilidad/RGPD.
>
> **Hecho en la última sesión técnica cerrada:** Fase 9.4 cerrada: informe
> `/analytics/outreach` con métricas específicas de secuencias y campañas, snapshot en
> `/analytics`, comparativa de canales, tablas top y variantes A/B agregadas.
> **Siguiente:** Fase 9.5, objetivos (goals) y seguimiento.

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

### 2026-06-30 (95) — Fase 10.1: documentos y firma electrónica
- **Modelo:** tabla `documents` (owner, negocio/persona opcional, título, cuerpo, estado
  draft/sent/signed, token único, firmante y fecha) — migración `0019`, aplicada.
- **App:** `/documents` redacta documentos (título, cuerpo, negocio y email del firmante
  opcionales), genera enlace público y copia al portapapeles; estado e info del firmante por
  tarjeta. Acciones owner-aware con Zod (`saveDocument`/`sendDocument`/`deleteDocument`).
- **Firma pública:** `/sign/[token]` (exenta de auth en `proxy.ts`) muestra el documento y
  permite firmar escribiendo el nombre ("type-to-sign", no criptográfica); `signDocument`
  registra firmante + fecha y pasa a `signed`. Idempotente (no refirmar).
- **Nav:** ítem "Documentos". `typecheck`, `lint` (a cero) y `build` en verde (rutas
  `/documents` y `/sign/[token]` compiladas).

### 2026-06-30 (94) — Fase 9.6: informes personalizados con filtros y exportación · Fase 9 COMPLETA
- **Informe de negocios** en `/analytics/reports`: filtros por estado, embudo y rango de
  fechas (sobre creación o cierre), agrupación por etapa/estado/mes/campaña, resumen
  (negocios, valor total, ganados, valor ganado) y tabla agrupada o de detalle. Todo
  dirigido por URL (patrón de `/deals`), con barra de filtros cliente y resultados server.
- **Exportación CSV** en `/api/analytics/reports/deals/export` (auth, reutiliza `lib/csv`),
  respetando los filtros activos; BOM UTF-8 para Excel.
- **Código:** catálogo+parseo compartido en `src/lib/reports.ts`; fetch owner-aware +
  agregación pura testeable en `src/server/queries/reports.ts` (`fetchDealsReportRows` +
  `buildDealsReport`); `ReportFilters` (cliente) y `DealsReportResults` (server); ítem de
  navegación "Informes".
- **Verificado:** dev login → `/analytics/reports?groupBy=status` HTTP 200 con filtros y
  resumen; CSV HTTP 200 (`text/csv`, BOM, cabecera correcta); **cross-check**: 18 negocios en
  el resumen = 18 filas de datos del CSV. `pnpm typecheck`, `pnpm lint` (a cero) y
  `pnpm build` en verde.
- **Fase 9 (Analítica y reporting) COMPLETA:** 9.1 dashboard · 9.2 embudo/victoria · 9.3
  rendimiento de email · 9.4 secuencias/campañas · 9.5 objetivos · 9.6 informes+export.

### 2026-06-30 (93) — Fase 9.5: objetivos (goals) y seguimiento
- **Modelo:** nueva tabla `goals` (owner, métrica, periodo, objetivo) — migración
  `0018_yielding_runaways`. **Fix de meta drizzle:** `0017_snapshot.json` tenía `id`
  duplicado (igual al de 0016) y `prevId` apuntando a 0015 (corrupción de la fase T
  concurrente); corregidos `id` (nuevo) y `prevId` (→0016) para poder generar 0018. La 0017
  es data-only, su esquema ya era idéntico al de 0016.
- **Métricas** (owner-aware, periodo en curso mes/trimestre): ingresos ganados, negocios
  ganados, negocios creados, actividades completadas y emails enviados. Catálogo y helper de
  periodo en `src/lib/goals.ts`; progreso en `src/server/queries/goals.ts`
  (`listGoalsWithProgress(ForOwner)`), CRUD en `src/server/actions/goals.ts` (Zod).
- **UI:** ruta `/analytics/goals` + ítem de navegación "Objetivos". `GoalsView` lista los
  objetivos con barra de progreso (CSS), % y estado conseguido, y un diálogo crear/editar/
  eliminar. Estado vacío cuidado.
- **Verificado:** `tsx` contra BD real (datos QA borrados) — insertados 2 objetivos para el
  usuario dev: `deals_won` actual=1/target=3 → 33%, `activities_completed` actual=5/target=5
  → 100%, ambos coinciden con conteos independientes. Migración aplicada (`pnpm db:migrate`).
  `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-30 (92) — Fase 9.4: métricas de secuencias y campañas
- **Datos:** nueva query `getOutreachMetrics` (`src/server/queries/analytics-outreach.ts`)
  que agrega secuencias, inscripciones, eventos `email_events.meta.sequence`, campañas y
  `campaign_recipients` en una lectura owner-aware. Calcula estados, volumen enviado,
  apertura, clic, respuesta, bajas, rebotes/quejas, audiencia, entrega y variantes A/B.
- **UI:** nueva ruta `/analytics/outreach` con KPIs ejecutivos, comparativa de canales,
  estado operativo, tablas top de secuencias/campañas enlazadas a sus paneles y
  rendimiento agregado de variantes A/B. `/analytics` incorpora el snapshot
  "Secuencias y campañas".
- **Documentación:** roadmap marcado en 9.4 y siguiente paso actualizado a 9.5
  (objetivos y seguimiento).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-30 (91) — Fase 9.3: rendimiento transversal de email
- **Datos:** `getEmailPerformance`/`computeEmailPerformance` agregan `email_events` de
  los últimos 30 días con conteos únicos por mensaje/destinatario/inscripción para no
  inflar aperturas y clics repetidos. Distingue canales (Gmail 1:1, secuencias,
  campañas y otros envíos), tasas de apertura/clic/respuesta/baja/rebote, actividad
  diaria, enlaces más clicados y señales recientes.
- **UI:** nueva ruta `/analytics/email` con KPIs ejecutivos, desglose por canal, gráfico
  diario de envíos/señales, top de enlaces clicados y feed de señales recientes. El
  dashboard `/analytics` incorpora un snapshot de rendimiento de email enlazado al
  informe dedicado.
- **Documentación:** roadmap marcado en 9.3 y siguiente paso actualizado a 9.4
  (métricas específicas de secuencias y campañas).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-30 (90) — Fase 9.2: embudo de conversión y tasa de victoria
- **Informe dedicado:** nueva ruta `/analytics/funnel` con selector de embudo, KPIs de
  conversión completa, tasa de victoria, valor en juego y perdidos. La vista muestra la
  conversión histórica por etapa a partir de `deal_stage_events` y enlaza con la vista de
  métricas de Negocios para el embudo activo.
- **Métricas:** `getFunnelMetrics` añade `closed`, `winRate`, `wonValue` y `lostValue` por
  embudo. La consulta histórica de entradas por etapa ahora respeta también `personIds`,
  para que los filtros de contactos no mezclen datos ajenos al subconjunto activo.
- **Dashboard:** el snapshot de `/analytics` enlaza al informe nuevo y muestra `% victoria`
  cuando hay negocios cerrados.
- **Documentación:** roadmap marcado en 9.2 y siguiente paso actualizado a 9.3
  (rendimiento de email).
- **Verificado:** `pnpm typecheck`, `pnpm lint`, `pnpm build` y render real de
  `/analytics/funnel` tras `/api/dev-login` (HTTP 200, contenido esperado y sin overlay de
  Next).

### 2026-06-29 (89) — Fase 9.1: dashboard principal de analítica
- **Dashboard `/analytics`:** retomado el WIP de Claude desde `git stash` e integrado en
  la app. La página muestra KPIs de negocios abiertos, valor en juego, previsión ponderada,
  ganado del mes y tasa de victoria.
- **Gráficas server-rendered:** componentes `src/components/analytics/*` con barras CSS
  para previsión por mes, actividad completada de los últimos 14 días, ganados por mes y
  snapshot del embudo con enlace a `/deals?view=metrics`.
- **Datos:** nueva query owner-aware `src/server/queries/analytics.ts` con agregación pura
  `computeAnalyticsOverview` (testeada con reloj fijo) y carga de negocios abiertos,
  cerrados y actividades recientes.
- **Navegación:** grupo "Análisis" con "Analítica" activo; corregido `Secuencias` para que
  no aparezca como próximamente.
- **Verificado:** `computeAnalyticsOverview` con `tsx`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build` y render real de `/analytics` (HTTP 200) en verde.

### 2026-06-29 (88) — Fase T.6: auditoría de entregabilidad y cumplimiento
- **Auditoría visible en `/campaigns`:** nueva query owner-aware `getDeliverabilityAudit`
  y componente `DeliverabilityAuditPanel` con revisión de Gmail 1:1, Resend masivo,
  consentimiento/RGPD, bajas, supresiones, rebotes/quejas y calentamiento. Reutiliza
  `getResendReadiness` para no duplicar estados y no expone tokens, API keys ni secretos.
- **Gmail 1:1:** comprueba cuenta Google, refresh token, permisos `gmail.send` y
  `gmail.readonly`, estado del buzón y límite diario conservador.
- **Resend/volumen:** comprueba API key, remitente, dominio/DNS como revisión manual,
  webhook, URL pública, datos RGPD, `List-Unsubscribe`, supresiones activas y ritmo de
  lotes/pausas/ventana.
- **Documentación:** `docs/08-EMAIL-RESEND-Y-REDACCION.md` y `docs/SETUP.md` explican lo
  que debe configurar el usuario antes de enviar volumen real y una rampa de
  calentamiento orientativa. Roadmap marcado en T.6. La Fase T queda cerrada y lo
  siguiente es retomar Fase 9.1 desde `stash@{0}`.
- **Verificado:** `pnpm typecheck`, `pnpm lint`, `pnpm build` y render real de
  `/campaigns` (HTTP 200 con auditoría visible) en verde.

### 2026-06-29 (87) — Fase T.5: mejoras de escala en campañas y secuencias
- **Campañas:** `duplicateCampaign` crea borradores completos (contenido HTML/texto,
  reply-to, segmento y ajustes, sin destinatarios ni métricas heredadas). `/campaigns`
  añade acción **Duplicar**, preparación mínima por tarjeta (Resend, audiencia alcanzable,
  RGPD y contenido) y bloquea envío/programación cuando esa preparación falla.
- **Pausa/reanudación/reintentos:** campañas en `sending` pueden pausarse (`paused`) y
  reanudarse sin borrar destinatarios. Las enviadas/fallidas con destinatarios `failed`
  pueden reintentar solo esos emails (`failed → pending`), manteniendo el índice único
  `campaign_id + email_normalized`.
- **Idempotencia Resend:** cada envío, reanudación o reintento genera `delivery.runId` y
  `sendNextCampaignBatch` lo incorpora a la clave de idempotencia por lote, evitando
  choques entre ejecuciones.
- **Secuencias:** duplicado como borrador con todos los pasos, activar/pausar desde la
  tarjeta con reencolado seguro de inscripciones activas y envío de prueba al propio
  usuario desde cada paso/variante de email.
- **Verificado:** `pnpm typecheck` y `pnpm lint` en verde durante el desarrollo; gates
  completos al cerrar la tarea.

### 2026-06-29 (86) — Fase T.4: preparación de contacto masivo (checklist Resend)
- **Checklist visible** en `/campaigns`: nuevo componente `ResendChecklist`
  (`src/components/campaigns/resend-checklist.tsx`, render puro con `<details>` nativo,
  abierto si falta algún requisito) alimentado por la query owner-aware `getResendReadiness`
  (`src/server/queries/campaigns.ts`).
- **Estados, nunca secretos:** API key (`isResendConfigured`), remitente
  (`getDefaultCampaignFrom`), datos RGPD del pie (`campaignComplianceErrorMessage` sobre los
  defaults de entorno), webhook (`RESEND_WEBHOOK_SECRET`) y URL pública
  (`NEXT_PUBLIC_APP_URL`). El dominio (SPF/DKIM/DMARC) se marca como verificación **manual**
  (no comprobable desde la app). Distingue **requeridos** vs **recomendados**; `ready` no se
  bloquea por los manuales.
- Muestra **nº de supresiones** (RGPD) y los **límites de envío** reales
  (`getCampaignDeliveryConfig`: tamaño de lote, pausa, máx. lotes/ejecución, ventana y zona).
- **Verificado:** render real `/campaigns` HTTP 200 con todos los ítems y el badge de estado
  reflejando el entorno ("1 pendiente"). `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build`
  en verde.

### 2026-06-29 (85) — Fase T.3: acciones CRM dentro de secuencias
- **Nuevo paso `crm_action`** en el builder de secuencias: mover de etapa/embudo, añadir/
  quitar etiqueta, actualizar campo (contacto/empresa/negocio), crear tarea, inscribir o
  parar otra secuencia, notificar y llamar a webhook. **Sin migración**: el tipo es texto y
  la config se guarda en `sequence_steps.settings.action` (validada con Zod en
  `src/lib/validations/sequence.ts`, unión discriminada por `kind`).
- **Servicio reutilizable** `src/server/services/crm-actions.ts` (`executeCrmAction`) con la
  lógica de cada acción; cableado en el workflow Inngest `run-sequence` mediante
  `runSequenceCrmActionStep` (carga la inscripción, parsea la config y ejecuta sobre el
  contacto/empresa/negocio de la inscripción). Catálogo de etiquetas/orden y `defaultCrmAction`
  en `src/lib/sequences.ts`; opciones del builder (embudos+etapas, etiquetas, secuencias) en
  `listSequenceCrmActionOptions`.
- **Caso clave (mover a otro embudo):** si el contacto no tiene negocio en el embudo destino
  se **crea la entrada** en su etapa inicial y se mueve (recomendado), con toggle visible
  **`createIfMissing`** (por defecto activo). Si se desactiva y no existe, se **omite** y se
  registra en el resultado del paso.
- **UI:** botón "Acción CRM" en el editor, selector de acción y campos por tipo, con errores
  por campo y degradación si faltan etiquetas/secuencias.
- **Verificado:** `tsx` contra BD real (datos QA borrados) — `executeCrmAction`: mover a otro
  embudo crea la entrada (1 negocio en etapa destino, 2 eventos de etapa), `createIfMissing=false`
  sin negocio se omite, etiqueta añadida, campo actualizado, parar secuencia deja la inscripción
  en `stopped`. Render real `/sequences` HTTP 200. `pnpm typecheck`, `pnpm lint` (a cero) y
  `pnpm build` en verde.
- **Nota de relevo:** el WIP de la Fase 9.1 (dashboard de analítica) queda aparcado en
  `git stash` (`stash@{0}`) para no mezclarlo con la Fase T; se retoma con `git stash pop`.

### 2026-06-29 (84) — Fase T.2: plantillas comerciales base
- **Catálogo comercial:** nuevo `src/lib/email/sales-templates.ts` con 5 plantillas listas
  para usar: primer contacto consultivo, follow-up, respuesta a interés, recuperación de
  silencio y cierre para reunión. Todas usan merge tags seguros con fallback y no envían
  automáticamente.
- **Persistencia:** migración `0017_ready_sales_templates` para sembrarlas en
  `email_templates` de usuarios existentes con `category='sales'`, sin duplicar ni pisar
  plantillas editadas.
- **Restauración:** Ajustes → Plantillas de email muestra badge "Comercial" y añade el
  botón idempotente **Instalar comerciales** para crear solo las que falten.
- **Seed:** `pnpm db:seed` también incluye las plantillas en entornos nuevos.
- **Docs:** roadmap T.2 marcada como hecha y `docs/08-EMAIL-RESEND-Y-REDACCION.md`
  actualizado con el estado implementado.
- **Verificado:** `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-29 (83) — Fase T.1: pantalla global Redactar email
- **Pantalla global:** nueva ruta `/emails/compose` con selector de contacto, vínculo
  opcional a negocio/hilo (`dealId`, `threadId`, `mode=reply`, `subject` por query),
  asunto, editor Tiptap, plantillas, merge tags, preview por destinatario, borrador IA
  opcional y envío real por Gmail 1:1.
- **Reutilización segura:** el formulario global usa el mismo motor que los botones de
  fichas (`sendEmail`, `RichEmailEditor`, plantillas existentes, tracking, firma, límite
  diario, validaciones Zod y autorización owner-aware en las capas existentes).
- **Accesos:** acción "Redactar email" en la paleta de comandos, acceso rápido en la
  barra lateral y botón en Bandeja, sin tocar el WIP de `src/lib/navigation.ts` que
  pertenece a 9.1.
- **Docs:** roadmap T.1 marcada como hecha y `docs/08-EMAIL-RESEND-Y-REDACCION.md`
  actualizado con el estado implementado.
- **Verificado:** `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-29 (82) — Plan: fase transversal de comunicación comercial
- **Estado corregido:** `ESTADO-ACTUAL.md` ya refleja la realidad de `git log`: Fase 8
  completa (8.1–8.7), pendientes transversales de 6.5 cerrados (`send_email` y
  `ai_summary`) y conversión temporal real del embudo hecha. La Fase 9 queda pendiente y
  9.1 aparece como WIP no commiteado de Claude que no debe mezclarse con esta tarea.
- **Roadmap:** añadida la **Fase T · Transversal de comunicación comercial** antes de la
  Fase 9, con T.1 pantalla global de redacción, T.2 plantillas comerciales, T.3 acciones
  CRM dentro de secuencias, T.4 preparación Resend, T.5 mejoras de escala y T.6 auditoría
  de entregabilidad/RGPD.
- **Documento nuevo:** `docs/08-EMAIL-RESEND-Y-REDACCION.md` explica cómo funciona Resend
  en Nexo CRM, qué debe configurar el usuario, cómo debe comportarse la futura pantalla
  de redacción y deja una plantilla base de primer contacto compatible con merge tags.
- **Tooling:** `pnpm-workspace.yaml` aprueba los build scripts necesarios (`esbuild`,
  `protobufjs`, `sharp`, `unrs-resolver`) para que `pnpm` pueda ejecutar gates en modo no
  interactivo sin pedir `approve-builds`.
- **Verificado:** `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-26 (81) — Transversal 6.4i v2: conversión temporal real del embudo
- **Modelo:** nueva tabla `deal_stage_events` (log de cambios de etapa: owner/deal/pipeline/
  from/to/at, migración `0016_famous_norman_osborn`) con **backfill** de los negocios
  existentes (un evento de entrada en su etapa actual).
- **Captura:** helper `recordStageChange`/`recordStageChangeSafely`
  (`src/server/services/deal-stage-events.ts`, best-effort) cableado en **todos** los
  puntos que mueven de etapa: `createDeal`, `updateDeal`, `moveDeal`, `bulkMoveDeals`
  (acciones), `addContactToFunnel` (alta en el embudo) y el `move_stage` de automatizaciones.
- **Métrica:** `getFunnelMetrics` añade por etapa `entered` (negocios distintos que
  entraron alguna vez, desde el historial) e `historicalConversion` (% respecto a la etapa
  anterior). El panel `DealsMetrics` muestra "N entraron (histórico · X%)" junto al snapshot.
  `FunnelStageMetric` gana los campos opcionales (la función pura `computeFunnelMetrics` no
  cambia).
- **Verificado:** `tsx` (borrado) — backfill pobló eventos; escenario controlado (4 deals:
  S1=4, S2=3, S3=1) da conversión 75%/33%; el cascade borra los eventos al borrar los
  negocios. Render real: `/deals?view=metrics` (HTTP 200) muestra "entraron (histórico…)".
  `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build` en verde.
- Con esto **quedan cerrados los pendientes transversales**; lo siguiente es la Fase 9.

### 2026-06-26 (80) — Transversal: acciones de automatización `send_email` y `ai_summary`
- Cerrado el pendiente de **6.5**: las dos acciones que quedaban como traza "pendiente" en
  `automation-executor.ts` ya **funcionan** (desbloqueadas por la Fase 8 + el transporte de
  email existente).
- **`send_email`:** carga la plantilla (`email_templates`, owner), construye el contexto de
  merge (`buildMergeContext`) con campos personalizados de persona/empresa, renderiza
  asunto/cuerpo (`renderMergeTags`), sanea el HTML y envía por Gmail (`sendGmailEmail`,
  registrando el hilo). **Degrada con elegancia**: salta si no hay contacto/email, si el
  contacto está dado de baja, si no hay plantilla o si Gmail no está conectado
  (`GmailServiceError` → `skipped`).
- **`ai_summary`:** reutiliza `generateAIHistorySummary` (8.3) sobre la entidad disparadora
  (contacto/negocio) y guarda el resultado como **nota** ("Resumen IA — …" + próximos
  pasos). Salta si la IA no está configurada o la entidad no es contacto/negocio.
- Ambas reflejadas también en el **dry-run** (6.8) con mensajes de simulación informativos.
- **Verificado:** `tsx` (borrado) con mock OpenAI-compatible y `executeAutomationRun`:
  `ai_summary` → run `completed` y **nota creada** ("Resumen IA…"); `send_email` → run
  `completed` con **degradación** (sin buzón Gmail válido → `skipped`, sin romper el flujo).
  `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-26 (79) — Fase 8.7: sentimiento de respuestas entrantes · Fase 8 COMPLETA
- **Modelo:** migración `0015_gray_skullbuster` añade `email_messages.sentiment`
  (`EmailSentiment`) y `email_messages.sentiment_at`.
- **Servicio** `src/server/services/ai-sentiment.ts` (`analyzeThreadSentiment`): clasifica
  los emails **entrantes** (`inbound`) de un hilo con `completeAI` (`modelPreference:"fast"`,
  temperatura 0) y salida estructurada Zod (`messageSentimentSchema`:
  `sentiment` positive/neutral/negative + `intent`); persiste `sentiment`/`sentiment_at` y
  traza en `ai_runs`. Por defecto solo los **no clasificados** (filtro `isNull`, acotado a
  10); `reanalyze` rehace todos. Owner-aware.
- **Validación** `src/lib/validations/ai-sentiment.ts`; **acción** `analyzeSentiment` en
  `actions/ai.ts` (Zod, owner, revalida el hilo).
- **UI** `/inbox/[threadId]`: botón **`AISentimentButton`** ("Analizar/Reanalizar
  sentimiento", con resumen de conteos en el toast) y **badge de sentimiento** por mensaje
  entrante (verde/gris/rojo); **degradación elegante** si no hay proveedor de IA.
- **Verificado:** `tsx` (borrado) con **mock OpenAI-compatible** y un hilo de 2 entrantes:
  `analyzeThreadSentiment` → 2 analizados (1 positive, 1 negative) persistidos; sin
  `reanalyze` no reprocesa (0, el filtro excluye los ya clasificados); `reanalyze=true`
  rehace los 2; 4 filas en `ai_runs`. `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build`
  en verde.
- **Fase 8 (IA agnóstica) COMPLETA:** 8.1 (capa) · 8.2 (emails) · 8.3 (resumen) · 8.4
  (NL→secuencia) · 8.5 (lead scoring) · 8.6 (next best action) · 8.7 (sentimiento). Todo
  sobre la abstracción `AIProvider`, gratis o de pago según `.env.local`.

### 2026-06-26 (78) — Fase 8.6: siguiente mejor acción por negocio con IA
- **Modelo:** migración `0014_hot_loa` añade `deals.next_best_action` (jsonb, tipo
  `DealNextBestAction`) y `deals.next_best_action_at` (timestamp).
- **Servicio** `src/server/services/ai-next-action.ts` (`generateNextBestAction`):
  reutiliza el **contexto rico del negocio** (`buildDealContext`, ahora **exportado** de
  `ai-history-summary.ts`) y pide a `completeAI` (con `modelPreference:"quality"`) una
  salida estructurada validada con Zod (`nextBestActionResultSchema`:
  `action`/`reason`/`urgency`/`steps`/`confidence`); persiste la sugerencia y queda
  trazada en `ai_runs`.
- **Validación** `src/lib/validations/ai-next-action.ts`; **acción** `suggestNextBestAction`
  en `actions/ai.ts` (Zod, owner, revalida la ficha).
- **UI:** nuevo panel **`AINextActionPanel`** en la ficha de negocio (`/deals/[id]`),
  estilo el panel de Resumen IA: carga la acción **persistida** al abrir (sin llamar al
  modelo), permite **Sugerir/Actualizar**, muestra urgencia/confianza/pasos y **degrada**
  si no hay proveedor de IA. `getDeal` ya devolvía las columnas nuevas.
- **Verificado:** `tsx` (borrado) con **mock OpenAI-compatible**: `generateNextBestAction`
  → acción/urgencia/3 pasos usando el modelo **quality**, persistencia en
  `deals.next_best_action` + `at`, y fila `ai_runs` `completed`. Render real vía login dev
  (IA configurada por env): el panel pinta la acción persistida (acción, "Urgencia alta",
  pasos, "Confianza media", botón "Actualizar"). `pnpm typecheck`, `pnpm lint` (a cero) y
  `pnpm build` en verde.

### 2026-06-26 (77) — Fase 8.5: lead scoring automático con IA
- **Modelo:** migración `0013_clammy_supernaut` añade `leads.score_reason` (texto) y
  `leads.scored_at` (timestamp) junto al ya existente `leads.score` (0-100).
- **Servicio** `src/server/services/ai-lead-score.ts`: `scoreLead(ownerId, leadId)`
  construye un contexto owner-aware del lead (contacto, empresa, **respuestas del
  formulario**, señales de interacción: tareas/notas/hilos) y pide salida estructurada
  (`leadScoreResultSchema`: `score`/`rationale`/`signals`, validada con Zod) a la capa
  agnóstica `completeAI` con `modelPreference:"fast"` y baja temperatura; persiste
  `score`/`score_reason`/`scored_at` y queda trazado en `ai_runs`. `scoreNewLeads` puntúa
  en lote los `new` aún sin puntuar (acotado, **excluye los ya puntuados**).
- **Validación** `src/lib/validations/ai-lead-score.ts`; **acciones**
  `scoreLeadWithAI`/`scoreNewLeadsWithAI` en `actions/ai.ts` (Zod, owner, revalida).
- **UI `/leads`:** columna **Puntuación** con badge de color (caliente/templado/frío) y la
  razón en el tooltip; acción **"Puntuar/Repuntuar con IA"** por fila; botón **"Puntuar
  nuevos"** (lote); **orden por puntuación** (`?sort=score`); **degradación elegante** si
  no hay proveedor de IA (aviso + acciones ocultas). `listLeads` admite `sort` y devuelve
  `scoreReason`/`scoredAt`.
- **Verificado:** `tsx` (borrado) con **mock OpenAI-compatible** local end-to-end:
  `scoreLead` → 82/razón/3 señales (usa el modelo **fast**), persistencia correcta, fila
  en `ai_runs` `completed` con tokens, y `scoreNewLeads` puntúa 2/2 excluyendo el ya
  puntuado. Render real vía login dev (IA "configurada" por env): columna/badge "88 ·
  Caliente", "Sin puntuar", botón "Puntuar nuevos" y `?sort=score`=200. `pnpm typecheck`,
  `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-26 (76) — Fase 8.4: secuencias y automatizaciones por lenguaje natural
- **Contrato IA:** nuevo `src/lib/validations/ai-workflow.ts` con entrada
  `sequence|automation` + instrucción y salidas estructuradas separadas para secuencias y
  automatizaciones. La IA devuelve nombres humanos; el servidor traduce a IDs reales y
  valida el resultado final con `sequenceBuilderSchema` / `automationInputSchema`.
- **Servicio:** `src/server/services/ai-workflow-draft.ts` usa `completeAI` con
  `workflow.sequence_draft` / `workflow.automation_draft`, `AI_MODEL_FAST`, coste y traza
  en `ai_runs`. Carga catálogos owner-aware de etapas, etiquetas, secuencias, plantillas
  y campos personalizados; resuelve referencias por nombre y añade advertencias cuando
  falta una referencia. Las automatizaciones se limitan a acciones ejecutables hoy
  (`create_task`, `enroll_sequence`, `add_label`, `move_stage`, `update_field`,
  `webhook`, `notify`).
- **Server Actions:** `generateWorkflowDraft` valida sesión + Zod y devuelve un borrador
  revisable. `createAutomationDraft` persiste automatizaciones IA siempre como `draft`
  y abre el builder para revisar, probar en seco y activar manualmente.
- **UI:** `/sequences` y `/automations` tienen botón **Crear con IA**. En secuencias el
  resultado se abre en el editor existente sin guardar directamente; en automatizaciones
  se guarda como borrador y redirige a `/automations/[id]`. La UI muestra preview,
  advertencias, modelo, coste y degradación si falta proveedor.
- **Verificado:** prueba `tsx` contra BD real con servidor OpenAI-compatible local fake
  (datos QA borrados): genera secuencia válida, genera automatización válida, resuelve
  etapa/etiqueta/secuencia/campo personalizado y registra dos `ai_runs=completed`.
  `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-26 (75) — Fase 8.3: resumen del historial de contacto/negocio
- **Contrato y acción:** `src/lib/validations/ai-history.ts` define entrada
  `person|deal` + enfoque opcional y salida estructurada (`headline`, `summary`,
  hechos, riesgos, próximos pasos, preguntas abiertas, confianza y última interacción).
  `src/server/actions/ai.ts` valida con Zod, exige sesión y delega en el servicio.
- **Servicio IA:** `src/server/services/ai-history-summary.ts` usa `completeAI` con
  `modelPreference="fast"`, `history.person_summary`/`history.deal_summary`, coste y
  traza en `ai_runs`. Carga contexto owner-aware y acotado: datos base, empresa,
  etapa/embudo/valor, notas, actividades, hilos/mensajes de email, leads y envíos de
  formularios cuando aplican. El prompt pide no inventar hechos y devolver JSON válido.
- **UI:** nuevo `AIHistorySummaryPanel` en las fichas de contacto y negocio. Genera bajo
  demanda (no al abrir la ficha), permite añadir enfoque, muestra resumen editable,
  hechos clave, riesgos, próximos pasos, preguntas abiertas, confianza, coste/modelo y
  contexto usado. Si falta IA configurada, degrada con el motivo sin romper la ficha.
- **Verificado:** prueba `tsx` contra BD real con servidor OpenAI-compatible local fake
  (datos QA borrados): resumen de contacto y negocio, contexto con leads/formulario/deal/
  email, y dos `ai_runs` completadas. `pnpm typecheck`, `pnpm lint` (cero avisos) y
  `pnpm build` en verde.

### 2026-06-25 (74) — Fase 8.2: redacción y respuesta de correos asistida
- **Servicio IA de email:** `src/server/services/ai-email.ts` genera borradores con
  `completeAI`, salida estructurada `subject/bodyText`, modelo rápido, coste estimado y
  traza `ai_runs` (`email.draft` / `email.reply_draft`). El prompt usa contexto
  owner-aware de contacto, empresa, negocio e hilo, más muestras recientes de emails
  enviados y plantillas para imitar el tono sin copiar frases.
- **Server Action:** `generateEmailDraft` valida con Zod, exige sesión y devuelve un
  borrador editable; sin IA configurada degrada con `not_configured`.
- **UI:** el compositor de email incorpora intención, tono y botón IA; rellena asunto y
  cuerpo pero **no envía**. En respuestas de hilo preserva el asunto para no romper el
  threading de Gmail. `/inbox/[threadId]` añade botón **Responder** con el mismo
  compositor, `threadId`, plantillas, merge tags y estado Gmail/IA.
- **Verificado:** prueba `tsx` con servidor OpenAI-compatible local fake y datos QA en BD
  limpiados: respuesta preserva asunto, manda JSON Schema, usa `AI_MODEL_FAST`, calcula
  coste, registra `ai_runs=completed`; prueba adicional confirma error `not_configured`
  sin proveedor.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-25 (73) — Fase 8.1: capa de IA agnóstica de proveedor
- **Persistencia:** migración `0012_flat_namor` aplicada con tabla `ai_runs` owner-aware
  para registrar proveedor, modelo, estado, tokens, coste estimado, latencia, resúmenes
  seguros de petición/respuesta y errores.
- **Arquitectura:** nueva capa `src/server/ai` con interfaz `AIProvider`, configuración
  por `.env.local`, selector de modelo normal/rápido, estimación de coste y adaptador
  `openai-compatible` (Groq, OpenRouter, Together, Ollama/LM Studio, etc.).
- **Servicio:** `src/server/services/ai.ts` expone `completeAI`, centraliza timeout,
  reintentos, salida estructurada con Zod/JSON Schema, validación de JSON devuelto,
  trazas en `ai_runs` y degradación controlada cuando falta configuración.
- **UI/operación:** Ajustes muestra el estado de IA y ejecuciones recientes sin exponer
  claves ni prompts completos; `SETUP.md` documenta Groq/OpenAI-compatible, Ollama local
  y variables opcionales de coste/reintentos.
- **Verificado:** prueba `tsx` con servidor OpenAI-compatible local fake: salida
  estructurada validada, modelo rápido seleccionado, coste calculado, fila `ai_runs`
  completada y error `not_configured` controlado sin proveedor.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-25 (72) — Plan: Fase 8 (IA) reescrita como AGNÓSTICA de proveedor
- **Decisión de producto del usuario:** la IA no se ata a Claude; se prepara para
  **cualquier proveedor, incluidos gratuitos**, y se decide después. Se construirá una
  interfaz `AIProvider` + adaptadores; un único adaptador `openai-compatible` cubre la
  mayoría (OpenAI, Groq, OpenRouter, Together, Mistral, DeepSeek, **Ollama/LM Studio
  local**…), más `gemini` y `anthropic`. Selección y claves **solo por `.env.local`**;
  cambiar de proveedor no toca código.
- **Docs reescritos:** Fase 8 en `04-ROADMAP-DETALLADO.md` (objetivo, arquitectura, 8.1
  redefinida), sección 9 de `02-MODELO-DE-DATOS.md` (`ai_runs` con `provider`,
  agnóstica), y **nuevo `docs/07-IA-PROVEEDORES-Y-MODELOS.md`** con la recomendación de
  modelos (gratis + de pago) y ejemplos de `.env.local`.
- **Recomendación de modelos (consultados precios actuales de Claude vía skill `claude-api`):**
  empezar gratis con **Gemini 2.5 Flash** o **Groq + Llama 3.3 70B** (o **Ollama + Qwen2.5**
  local para privacidad/coste cero); de pago, **Claude Sonnet 4.6** (calidad) + **Claude
  Haiku 4.5** (volumen). Tabla por caso de uso en el nuevo doc.
- Solo documentación (sin código); gates no aplican.

### 2026-06-25 (71) — Pulido: panel de envíos en el editor de formularios
- **Observabilidad de la captación:** los envíos de un formulario ya se pueden ver en la
  app (antes solo se materializaban como leads). Nuevo panel **"Envíos recientes"** bajo el
  editor de `/forms/[id]` (`FormSubmissions`, render puro estilo "Ejecuciones recientes"):
  contacto creado/encontrado (enlace a la ficha), fecha, y los **datos del envío
  etiquetados** con los `label` de los campos del formulario (el honeypot `_hp` se excluye).
- **Capa:** query `listFormSubmissions(formId)` (owner-aware, join a persona) en
  `queries/forms.ts`; la página del editor la carga y la pasa al panel.
- **Verificado** vía login dev (datos QA borrados): el panel muestra los 2 envíos con
  nombre, datos etiquetados ("Mensaje", valores) y sin el honeypot. `pnpm typecheck`,
  `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-25 (70) — Fase 7.6: anti-spam (honeypot + rate limit) · Fase 7 cerrada
- **Honeypot** `_hp`: ya sembrado en `/f/[id]` (7.3) y descartado en silencio en
  `submitForm` (7.4); no crea persona/lead ni cuenta para el rate limit.
- **Rate limit** en `submitForm` (sobre envíos reales, ventana de 1 min): máx. **5 por
  IP+formulario** y tope global de **30 por formulario** (cuenta `form_submissions`
  recientes con `db.$count`). El route handler responde **429** con `Retry-After: 60` al
  exceder.
- **Verificado** con `tsx` (borrado): 6 envíos misma IP → `ok,ok,ok,ok,ok,rate_limited`;
  el honeypot tras el tope sigue devolviendo `ok` sin contar; otra IP sigue pasando; la
  limpieza confirma que solo los 5 permitidos crearon datos. `pnpm typecheck`,
  `pnpm lint` (a cero) y `pnpm build` en verde.
- **Fase 7 (Captación) COMPLETA:** 7.1 (migración) · 7.2 (constructor) · 7.3 (página
  pública + insertar) · 7.4 (endpoint de recepción) · 7.5 (bandeja de leads) · 7.6
  (anti-spam). Flujo end-to-end: formulario público → envío → persona/lead → automatización
  → bandeja → convertir a negocio.

### 2026-06-25 (69) — Fase 7.5: bandeja de leads
- **Página `/leads`** (`LeadsView`): pestañas por estado (Nuevos/Calificados/Convertidos/
  Basura/Todos) con **contadores**, y tabla con contacto (enlace a la ficha), empresa,
  origen, fecha relativa y estado. Acciones por fila: **calificar**, **marcar basura**,
  **volver a nuevos**, **convertir a negocio**, **ver contacto/negocio** y **eliminar**.
- **Conversión a negocio** (`convertLeadToDeal`): mete al contacto del lead en el embudo
  con `addContactToFunnel` (etapa "Cargadas"), captura el `deal` y marca el lead
  `status='converted'` con `converted_deal_id`; revalida `/leads` y `/deals`.
- **Capas:** query `src/server/queries/leads.ts` (`listLeads(status?)` con join a
  persona/empresa + `getLeadCounts`), acciones `src/server/actions/leads.ts`
  (`setLeadStatus` con Zod, `convertLeadToDeal`, `deleteLead`, todas owner-aware).
  "Leads" añadido a la navegación (grupo Comunicación).
- **Verificado:** `tsx` (borrado) — la **conversión** crea el deal y deja el lead
  `converted` con `convertedDealId`; render real vía login dev: `/leads` 200 con pestañas/
  contadores/badges, filtro `?status=junk` correcto (excluye los demás) y enlace en el nav.
  `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-25 (68) — Fase 7.4: endpoint de recepción del formulario
- **Endpoint público** `POST /api/forms/[id]/submit` (`src/app/api/forms/[id]/submit/route.ts`):
  parsea el `FormData` (urlencoded o multipart), extrae `ip` (`x-forwarded-for`) y
  `user_agent`, llama al servicio y **redirige 303** a `redirect_url` o `/f/[id]?ok=1`
  (form inexistente/no publicado → a `/f/[id]`, que muestra el aviso).
- **Servicio** `src/server/services/form-intake.ts` (`submitForm`, sin sesión; el
  `ownerId` sale del form): valida `active`; **honeypot** `_hp` (si viene relleno,
  descarta en silencio y responde ok); aplica los `mappings` para **empresa** (find/create
  por nombre), **persona** (dedupe por email case-insensitive; crea con `firstName` por
  defecto = parte del email; a la existente solo le enriquece campos personalizados y la
  empresa si estaba vacía) y **campos personalizados**; guarda `form_submissions` (sin el
  honeypot, con ip/user_agent) y crea un `lead` (`source` = nombre del form, `status='new'`).
- **Automatizaciones:** emite el evento `form_submitted` (`emitAutomationEventSafely`,
  persona) — disparo general; y si el form tiene `automation_id` con **otro** disparador,
  la ejecuta **en proceso** (best-effort, reusa `executeAutomationRun`; esperas inmediatas
  como el dry-run) evitando doble ejecución.
- **Verificado** con `tsx` (borrado): flujo completo (persona+empresa+submission+lead,
  `_hp` no guardado, ip), **dedupe** por email (mayúsculas → 1 persona, 2 envíos),
  **honeypot** (no crea nada), **not_found**; y **POST HTTP real sin sesión** → 303 a
  `?ok=1` con persona/lead creados (user-agent capturado). El fallo de Inngest sin
  `INNGEST_EVENT_KEY` lo absorbe `emitAutomationEventSafely`. `pnpm typecheck`,
  `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-25 (67) — Fase 7.3: página pública del formulario + insertar
- **Ruta pública `/f/[id]`** (`src/app/f/[id]/page.tsx`, fuera de `(app)`,
  `force-dynamic`): renderiza el formulario por id **solo si está `active`** (query
  pública `getPublicForm`, sin owner ni mapeos). Pinta intro + campos por tipo
  (texto/email/teléfono/largo/selección/checkbox), botón con el texto configurado, y
  muestra el **mensaje de éxito** con `?ok=1`. Casos borrador/inexistente → "no
  disponible". Incluye un **honeypot** oculto (`_hp`) para 7.6 y postea a
  `/api/forms/[id]/submit` (endpoint en 7.4).
- **proxy.ts:** añadidos los prefijos públicos `/f/` y `/api/forms` (sin login).
- **Editor:** panel **"Compartir e insertar"** con el enlace público y el snippet
  `<iframe>` + botón copiar; el `origin` se calcula en servidor con `headers()` y se pasa
  al `FormBuilder` (sin `window`, sin efectos, sin mismatch de hidratación).
- **Verificado** vía login dev + form de prueba (borrados): `/f/[active]` **sin cookie**
  responde 200 (el proxy no redirige a /login) y pinta todos los campos + `action` al
  endpoint; `?ok=1` muestra el éxito; borrador e id inexistente → "no disponible"; el panel
  de compartir del editor muestra el enlace `/f/{id}` y el iframe. `pnpm typecheck`,
  `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-25 (66) — Fase 7.2: constructor de formularios
- **`/forms` lista real** (sustituye el placeholder): tarjetas con estado
  (borrador/publicado/archivado), nº de campos y de envíos, crear (diálogo →
  `/forms/[id]`), publicar/despublicar y eliminar (`FormsView`).
- **Editor `/forms/[id]`** (`FormBuilder`): encabezado (nombre/descr/estado) con
  react-hook-form + Zod; **campos** (etiqueta, tipo texto/email/teléfono/largo/selección/
  sí-no, obligatorio, opciones de selección) reordenables; **mapeo** por campo a un campo
  del CRM (persona/empresa nativos + campos personalizados de persona) o "solo guardar";
  ajustes de envío (texto del botón, mensaje de éxito, URL de redirección), introducción
  y **automatización opcional** al recibir.
- **Capas:** catálogo `src/lib/forms.ts` (tipos de campo, destinos de mapeo, `uniqueFieldKey`),
  validación `src/lib/validations/form.ts`, queries `src/server/queries/forms.ts`
  (`listForms` con contador de envíos, `getForm`/`getFormForOwner`,
  `listFormBuilderOptions`) y acciones `src/server/actions/forms.ts`
  (`createForm`/`updateForm`/`setFormStatus`/`deleteForm`). Las **claves** de campo se
  derivan de las etiquetas al guardar (uniquificadas) y los mapeos se filtran a campos
  existentes; la automatización elegida se valida por `ownerId`. "Formularios" deja de ser
  "próximamente" en la navegación.
- **Verificado:** `tsx` (borrado) — `uniqueFieldKey` (slug + uniquificado),
  `formInputSchema` (acepta válido, rechaza clave/URL inválidas) y round-trip en BD (form
  con 3 campos + 2 mapeos + embed + redirect persistidos). Render real vía login dev:
  `/forms` (lista con contadores) y `/forms/[id]` (editor con campos cargados, selector de
  mapeo y automatización), HTTP 200 sin errores. `pnpm typecheck`, `pnpm lint` (a cero) y
  `pnpm build` en verde.

### 2026-06-25 (65) — Fase 7.1: migración de captación (forms/submissions/leads)
- **Esquema** `src/server/db/schema/forms.ts` con tres tablas y sus relaciones:
  - `forms`: `name`/`description`/`status` (`draft`/`active`/`archived`), `fields`
    (`FormFieldDef[]`), `mappings` (`FormMapping[]`), `redirect_url`, `embed_settings`
    (`FormEmbedSettings`) y `automation_id` (opcional, set null).
  - `form_submissions`: `data` (JSONB), `person_id` (creado/encontrado), `ip`,
    `user_agent`; cascade por `form_id` y por `owner_id`.
  - `leads`: `person_id`, `submission_id`, `source`, `status` (`new`/`qualified`/
    `converted`/`junk`), `score` (lead scoring, Fase 8) y `converted_deal_id`.
- **Migración** `drizzle/0011_far_shinko_yamashiro.sql` generada y aplicada
  (`db:generate` + `db:migrate`). Exportado desde `schema/index.ts`.
- **Verificado** con `tsx` (borrado): round-trip form → submission → lead con defaults
  correctos (`status='draft'`/`'new'`, `score=0`, `fields`/`mappings`/`embed`) y
  **cascade** real (borrar el form elimina sus submissions y pone `lead.submission_id`
  a null). `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-25 (64) — 6.4j: plantillas de automatización del embudo
- **Nueva plantilla rápida en `/automations`:** botón **Plantilla de embudo** para crear
  flujos al entrar en una etapa sin montar el grafo a mano.
- **Dos casos cubiertos:** `deal_stage_changed(stageId)` → `create_task` con asunto
  configurable, y `deal_stage_changed(stageId)` → `enroll_sequence` con secuencia
  seleccionada.
- **Seguridad y flujo profesional:** Server Action validada con Zod, ownership de etapa y
  secuencia, estado inicial `draft`, apertura directa del editor para revisar, dry-run y
  activar.
- **Verificado:** `tsx` contra BD real con sesión y `revalidatePath` stubbeados:
  creación de plantilla de tarea y de secuencia, triggers `deal_stage_changed`, grafos
  correctos y limpieza QA.

### 2026-06-25 (63) — 6.8: dry-run de automatizaciones
- **Server Action `dryRunAutomation`:** guarda una ejecución visible como
  `automation_run`, con `context.dryRun=true`, snapshot del grafo y entidad de muestra
  owner-aware cuando el disparador la necesita.
- **Executor en modo simulación:** `executeAutomationRun(..., { dryRun: true })` evalúa
  condiciones igual que producción, convierte esperas en log `skipped` sin llamar a
  `step.sleep` y simula acciones sin efectos reales. Valida configuración de etiquetas,
  etapas y secuencias sin crear tareas, mover negocios, inscribir contactos ni llamar
  webhooks.
- **UI:** el editor añade **Guardar y probar en seco**; primero persiste la versión que
  se ve en pantalla y luego lanza la simulación. El panel de ejecuciones marca esos runs
  con badge **Prueba en seco**.
- **Verificado:** `tsx` contra BD real con limpieza QA: condición true + espera de 1 día
  + `create_task` completan en dry-run, `sleep` no se llama, log contiene la simulación y
  el conteo de tareas reales queda en 0.

### 2026-06-25 (62) — 6.6: condiciones if/else y esperas reales
- **Executor por grafo:** `executeAutomationRun` ya no omite `wait`/`condition`; recorre
  aristas, evita bucles, deja log por nodo y conserva la idempotencia `waiting` →
  `running` → `completed/failed`.
- **Condiciones:** evalua operadores `eq`, `neq`, `contains`, `gt`, `lt`, `is_set` e
  `is_empty` contra `payload.*`, `event.*`, campos de persona/empresa/negocio y
  `custom:*`, resolviendo snapshots owner-aware.
- **Esperas reales:** `run-automations-for-event` pasa `step.sleep` al executor para que
  las esperas sean duraderas en Inngest; en pruebas se puede inyectar un `sleep` fake.
- **Builder:** los nodos condicion guardan ramas `true`/`false` configurables
  (continuar/detener) y persisten aristas con `branch`.
- **Verificado:** `tsx` contra BD real con datos QA borrados al final: rama true
  condicion + espera + tarea (`completed`, 1 accion) y rama false detenida sin efectos.
  `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-25 (61) — 6.4i: métricas del embudo (v1, instantánea)
- **Nueva vista `?view=metrics`** en `/deals`, con toggle **Kanban / Lista / Métricas**
  añadido a las tres vistas (`DealsBoard`, `DealsListView`, `DealsMetrics`).
- **Datos** (`src/server/queries/deals.ts`): `getFunnelMetrics(pipelineId, { personIds })`
  owner-aware, que **respeta el filtro de contacto** (6.4b). La agregación se extrajo a una
  función **pura** `computeFunnelMetrics` (separada del IO para poder verificarla). Devuelve:
  resumen (`open`, `value`, `forecast`, `stalled`, `won`, `lost`), **embudo por etapa**
  (`count`/`value`/`stalled`, `reached` = abiertos en la etapa o más adelante, y
  `conversionFromPrev` = `reached`/`reached` anterior en %), y **reparto por campaña**
  (top 8 + `hasMoreCampaigns`).
- **UI** (`src/components/deals/deals-metrics.tsx`): tarjetas de resumen, embudo por etapa
  con barras (ancho ∝ `reached`) y conversión/estancados, y barras por campaña. Reutiliza
  `PipelineCombobox` y `ContactFiltersBar`.
- **Limitación documentada:** la conversión es una **instantánea** del estado actual (no
  temporal); para la conversión real entre etapas hace falta historial de cambios de etapa
  (hoy solo `deals.stageChangedAt`).
- **Verificado:** `tsx` con **22 aserciones** sobre `computeFunnelMetrics` (open/valor/
  previsión, estancados con reloj fijo, `reached` acumulado, conversión 50%/33%, campañas
  ordenadas y agrupadas, won/lost excluidos, caso `active=null`); y render real vía login
  dev: `/deals?view=metrics` → HTTP 200, todas las secciones presentes, sin errores, y el
  "En el embudo = 15" coincide con un conteo independiente en BD. `pnpm typecheck`,
  `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-25 (60) — 6.4f: selector de embudo combobox con buscador + recordar el último
- **`PipelineCombobox`** (`src/components/deals/pipeline-combobox.tsx`): combobox con
  buscador (Popover de Base UI + Command/cmdk) que **sustituye al `<select>` nativo** de
  embudo en el Kanban (`DealsBoard`) y la Lista (`DealsListView`). Filtra los embudos por
  nombre; el activo lleva el check integrado del `CommandItem` (`data-checked`).
- **Recordar el último embudo abierto:** al elegir un embudo se guarda una cookie
  `nexo_deals_pipeline` (nombre en la lib neutra `src/lib/deals-pipeline.ts` para que la
  lea el servidor sin convertirse en client-reference). `deals/page.tsx` la lee con
  `cookies()` (Next 16, async) y la usa como **fallback** del embudo activo cuando no hay
  `?pipeline=` en la URL. **Precedencia: URL > cookie > primer embudo.**
- **Verificado** con login dev + embudo temporal (creado y borrado): aislando el trigger
  del combobox por su clase única, las 5 escenas dieron lo esperado — sin cookie/param →
  primer embudo; cookie=temp sin param → temp (fallback); cookie=temp + `?pipeline=real`
  → real (URL manda); cookie inválida → primer embudo; y el combobox funciona igual en la
  vista Lista. Sin marcadores de error. `pnpm typecheck`, `pnpm lint` (a cero) y
  `pnpm build` en verde.

### 2026-06-25 (59) — 6.4h: vistas guardadas del embudo de Negocios
- **Desacoplado el tipo de entidad de las vistas guardadas:** nuevo
  `SavedViewEntity = "person" | "organization" | "deal"` en
  `src/server/db/schema/crm.ts`, usado en la columna `saved_views.entityType` (sin
  migración: sigue siendo `text`), en `savedViewSchema.entityType`
  (`src/lib/validations/saved-view.ts`), en `listSavedViews`
  (`src/server/queries/saved-views.ts`) y en las acciones
  (`src/server/actions/saved-views.ts`: `pathFor("deal") → /deals`, `cleanFilters`
  preserva `pipeline`/`stage`/`view`). `CustomEntityType` sigue siendo solo
  person/organization para campos personalizados y archivos.
- **`SavedViewsBar` reutilizable en `/deals`:** acepta `entityType="deal"` y los campos
  `pipeline`/`stage`/`view` (en `ViewFilters`, `buildHref`, `sameFilters` y
  `hasFilters`). Se renderiza en el Kanban (`DealsBoard`) y en la Lista
  (`DealsListView`): el Kanban guarda **embudo + condiciones** (la etapa son las
  columnas; la vista por defecto es el tablero); la Lista añade **etapa + `view=list`**.
  La página carga `listSavedViews("deal")` y lo pasa a ambos.
- **Condiciones de campo personalizado preservadas:** `createSavedView` carga los campos
  personalizados de **persona** también cuando `entityType === "deal"` (las condiciones
  del embudo filtran por contacto); sin esto, `normalizeContactFilters` con defs vacíos
  las descartaba al guardar.
- **Filtro por etapa:** se aplica en la vista Lista (el param `stage` ya existía en
  `listDeals`); en Kanban son las columnas.
- **Verificado** con `tsx` (borrado): `savedViewSchema` acepta `deal` +
  pipeline/stage/view; round-trip real en BD (insert/list/delete de una vista `deal` con
  filtros intactos) sin mezclarse con las vistas `person`; y `normalizeContactFilters`
  conserva una condición `custom:` con defs de persona (1) y la descarta sin defs (0).
  `pnpm typecheck`, `pnpm lint` (a cero) y `pnpm build` en verde.

### 2026-06-23 (58) — 6.4h (base): cimientos de vistas guardadas del embudo
- `SavedViewFilters` (esquema) y `savedViewSchema.filters` (validación) ahora admiten
  `pipeline`/`stage`/`view` (compatible hacia atrás) para poder guardar vistas del
  embudo de Negocios.
- **Pendiente (documentado):** `saved_views.entityType` está atado a `CustomEntityType`
  (person/organization). Para vistas de `deal` hay que **desacoplar** ese tipo y luego
  reutilizar `SavedViewsBar` en `/deals`. Detalle en el roadmap (6.4h) y en el prompt de
  relevo. `pnpm typecheck`, `lint` y `build` en verde.

### 2026-06-23 (57) — 6.4g: acciones masivas en el embudo de Negocios
- **Server** (`actions/deals.ts`): `bulkMoveDeals`, `bulkAddLabelToDeals` (etiqueta al
  contacto, dedupe), `bulkEnrollDeals` (inscribe owner-aware + emite
  `sequence/run.requested`) y `bulkRemoveDealsFromFunnel` (soft-delete). Todas validan
  propietario y aceptan una lista de `dealId`.
- **UI** (`deals-board.tsx`): checkbox de selección por tarjeta (con
  `stopPropagation` para no interferir con el arrastre), tarjeta resaltada al
  seleccionar, y **barra de acciones sticky** con selects de mover/etiquetar/inscribir y
  botones "Quitar del embudo" y "Limpiar". La página pasa `labels` y las secuencias
  inscribibles al tablero.
- **Verificado:** `pnpm typecheck`, `lint` y `build` en verde; render de `/deals` con los
  checkboxes y sin overlay de error (las acciones son owner-scoped y replican patrones ya
  verificados: `inArray` update, dedupe de `entity_labels`/`enrollments`).

### 2026-06-23 (56) — 6.4e: "Cargar contactos" respeta el filtro activo
- `loadContactsIntoFunnel(conditions?)` normaliza las condiciones (con
  `customFieldDefs`), resuelve `personId` con `listPersonIdsByFilters` y
  `backfillContactsIntoFunnel(userId, personIds?)` solo carga esos (array vacío ⇒ 0, no
  carga todos). El botón del tablero pasa el filtro activo y muestra "Cargar filtrados".
- Verificado con `tsx`: backfill con subconjunto crea solo ese contacto; `[]` ⇒ 0.
- **Pulido:** al cambiar de embudo o alternar Kanban/Lista se **preserva el filtro**
  activo (antes se perdía): `deals-board` y `deals-list-view` construyen las URLs a
  partir de los parámetros actuales.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (55) — Fase 6.7: panel de ejecuciones de automatizaciones
- **Query** `listAutomationRuns(automationId)` (owner-aware): runs recientes con estado,
  disparador, entidad, error, fechas y `log`.
- **UI** `AutomationRuns` (render puro) bajo el editor en `/automations/[id]`:
  "Ejecuciones recientes" con badge de estado, disparador, fechas, error y **log por
  nodo** (ok/skipped/failed con su mensaje). Hace visible lo que ejecuta 6.5.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (54) — Fase 6.5: ejecución real de acciones de automatización
- **`src/server/services/automation-executor.ts`** (`executeAutomationRun`): procesa un
  `automation_runs` en `waiting` (claim atómico `waiting`→`running`), resuelve la entidad
  disparadora (persona/empresa/negocio + relaciones) y ejecuta los nodos de acción del
  grafo, guardando un log por nodo y dejando el run en `completed`/`failed`.
- **Acciones:** `create_task` (actividad), `add_label` (con dedupe y validación de
  propietario), `move_stage` (solo negocios), `update_field` (sobre `custom_fields` de la
  entidad), `enroll_sequence` (inscribe owner-aware + emite `sequence/run.requested`),
  `webhook` (POST con el evento) y `notify` (traza). `send_email` y `ai_summary` quedan
  como "pendiente" sin fallar.
- **Cableado:** `run-automations-for-event` ejecuta cada run creado (idempotente).
- **Verificado** con `tsx` (borrado): evento `record_created`(person) → automatización
  activa coincide → run creado → 3 acciones (tarea + etiqueta + notify) ejecutadas,
  estado `completed`; 2.ª ejecución `skipped` (idempotencia). `pnpm typecheck`, `lint` y
  `build` en verde.

### 2026-06-23 (53) — 6.4d: filtros 6.4b en Kanban y Lista de Negocios
- **Filtros compartidos en ambas vistas:** `deals/page.tsx` decodifica el parámetro de
  filtro y, si hay condiciones, resuelve los `personId` que cumplen con
  `listPersonIdsByFilters` (nueva en `queries/contacts.ts`, reutiliza `personWhere` de
  6.4b sin límite bajo). `getBoard(pipelineId, { personIds })` y `listDeals({ personIds })`
  acotan por `inArray(deals.personId, …)` (array vacío ⇒ sin resultados).
- **UI:** `ContactFiltersBar` ahora acepta `basePath` (default `/contacts`) y se renderiza
  en el Kanban (`DealsBoard`) y en la Lista (`DealsListView`) con `basePath="/deals"`,
  preservando el resto de parámetros (vista/embudo) desde la URL.
- **Verificado:** semántica con `tsx` (campaign "comienza por 500" → solo el contacto
  correcto → solo su deal) y render vía login de desarrollo de `/deals`, `/deals?view=list`
  y `/deals?filter=campaign:starts_with:500` (200, barra de filtros visible, sin overlay).
  `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde. **6.4d completa.**

### 2026-06-23 (52) — 6.4d (layout): muchos embudos ya no cortan la página
- **Fix de layout:** `min-w-0` en `SidebarInset` y en el `main` de `(app)/layout.tsx`.
  Era el gotcha clásico de shadcn: el contenedor `overflow-x-auto` del Kanban empujaba
  el ancho en vez de hacer scroll, cortando la página con muchos embudos/etapas. Ahora
  el tablero hace scroll horizontal dentro del área disponible.
- **Pendiente 6.4d:** filtros 6.4b en Kanban **y** Lista (plan de menor riesgo en
  "Siguiente paso": filtrar deals por `personId` de los contactos que cumplen el filtro,
  reutilizando el motor de 6.4b; renderizar `ContactFiltersBar` en ambas vistas).
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (51) — 6.4c: ajustes (dedupe global + selector) y requisitos 6.4d
- **Fix "Cargar contactos":** el dedupe de `addContactToFunnel` ahora mira **cualquier
  embudo** (antes solo el por defecto). Solo se añaden contactos que no estén en NINGÚN
  pipeline. Verificado con `tsx` (contacto en otro embudo → no se recarga; sin deal → sí).
- **Selector de embudo** acotado (`max-w-[12rem] truncate`) para que nombres largos no
  estiren la cabecera (mejora parcial de 6.4d).
- **Registrados requisitos del usuario para 6.4d:** filtros 6.4b idénticos en Kanban
  **y** Lista; y que añadir muchos embudos no rompa la página de Negocios (selector
  escalable + layout). Ver "Siguiente paso".
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (50) — 6.4c: el tablero de Negocios es el embudo de contactos
- **Decisión del usuario** (captura + pregunta): Negocios pasa a ser el embudo de
  prospección de **contactos** (reutiliza `deals`+etapas+Kanban), no una sección aparte.
- **Servicio** `src/server/services/contact-funnel.ts`: `getDefaultFunnelEntry` (embudo
  por defecto + primera etapa "Cargadas"), `addContactToFunnel(Safely)` (1 deal por
  contacto en "Cargadas", dedupe por persona+embudo, título = empresa) y
  `backfillContactsIntoFunnel`.
- **Altas automáticas:** `createPerson` (manual) e `importContacts` (Excel/CSV) meten el
  contacto en "Cargadas" automáticamente (best-effort, sin emitir eventos para no
  cascadear). Acción `loadContactsIntoFunnel` + botón **"Cargar contactos"** (backfill).
- **Tablero** (`deals-board.tsx`): tarjeta = **empresa (título) + contacto debajo**;
  **toda la tarjeta arrastrable** (listeners en la raíz; con la restricción de 6px el
  clic simple sigue abriendo la ficha). Quitado el grip y el importe (ruido 0 €).
- **Verificado** con `tsx` (borrado): alta en "Cargadas", título = empresa, valor 0,
  dedupe correcto. `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde. (El arrastre
  dnd no se prueba en headless; verificados el render y la lógica de servidor.)

### 2026-06-23 (49) — Fase 6.4b: filtros profesionales de contactos
- **Contrato compartido:** nuevo `src/lib/contact-filters.ts` para condiciones de
  contacto en URL (`filter` repetible), operadores (`contiene`, `comienza por`, `es`,
  `no es`, `tiene valor`, `está vacío`), campos de serie, empresa, estado marketing y
  campos personalizados.
- **Servidor:** `listPersons`/`listPersonsForExport` aceptan condiciones AND owner-aware
  y resuelven prefijo case-insensitive para `campaign`, empresa y `custom_fields`.
  `/api/contacts/export` reutiliza los mismos filtros. Las vistas guardadas guardan
  condiciones avanzadas y las normalizan en servidor.
- **UI Contactos:** barra tipo Pipedrive con chips activos, eliminar condición, **Añadir
  condición**, buscador de campos, sugeridos, grupos Contacto/Empresa/Campos
  personalizados y **Limpiar**; las vistas guardadas comparan y aplican también esas
  condiciones.
- **Audiencias:** segmentos incorporan operador `starts_with` para campos de texto
  principales, incluida `campaign`, para campañas/secuencias que reutilizan audiencia.
- **Verificado:** login dev + datos temporales QA: filtro por `campaign` empieza por
  `QA64B-005`, export CSV, campo personalizado `custom:qa64b_serie` y empresa; cada caso
  devolvió el contacto esperado y excluyó el no coincidente. Datos QA limpiados.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (48) — Precisión de UX para filtros y embudo de contactos
- **Filtros 6.4b:** definidos como experiencia tipo Pipedrive: chips de condiciones
  activas (`Campaña empieza por 005`), botón **Añadir condición**, buscador, sugerencias,
  campos agrupados por entidad y acciones **Limpiar**/**Guardar vista**. La condición de
  prefijo debe mantenerse en URL y vistas guardadas.
- **Embudo 6.4c:** aclarado que el pipeline pendiente es de **contactos/prospección**,
  no de actividades ni negocios. El tablero debe mostrar columnas horizontales con
  contactos, y cada tarjeta debe titularse con la empresa vinculada y debajo el nombre
  del contacto; varios contactos de una misma empresa son varias tarjetas.
- **Criterio visual:** los filtros de 6.4b deben reutilizarse en el futuro embudo de
  contactos para filtrar por `campaign`/empresa/contacto antes de mover etapas.

### 2026-06-23 (47) — Fase 6.4a: `campaign` nativo en contactos
- **Modelo:** migración `drizzle/0010_glossy_catseye.sql` añade `persons.campaign`
  nullable, índice compuesto `owner_id/campaign` y un índice funcional
  `owner_id/lower(campaign)` para búsquedas case-insensitive por prefijo. El esquema
  Drizzle y el seed ya incluyen campañas de ejemplo.
- **Contactos:** validaciones y acciones aceptan `campaign`; listado, ficha, formulario,
  búsqueda simple, export CSV y eventos de automatización lo tratan como campo nativo.
- **Importación:** Excel/CSV auto-mapea `campaña`, `campana`, `campaign` y
  `utm_campaign`; la preview muestra campaña y el dedupe/update la conserva.
- **Audiencias y emails:** segmentos reconocen `campaign`; campañas/secuencias pasan el
  campo al motor de merge tags como `{{campaign}}` y alias `{{campana}}`.
- **Verificado:** `pnpm db:migrate`, script temporal `tsx` (borrado) comprobando mapeo,
  Zod, segmentos, merge tags y columna/índices reales en PostgreSQL; login dev con
  `curl` a `/contacts`, `/contacts/import` y `/api/contacts/export`; `pnpm typecheck`,
  `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (46) — Replanificación prioritaria: contactos, embudos y filtros
- **Decisión de producto:** pausar 6.5 hasta corregir cuatro puntos detectados por el
  usuario: `campaign` nativo en contactos, filtros por campo con operador "comienza por",
  embudo de contactos/prospección no basado en actividades y UX de Negocios con muchos
  funnels.
- **Roadmap:** añadidas las tareas **6.4a–6.4d** antes de 6.5 para que el siguiente
  trabajo empiece por `campaign` nativo y no por acciones de automatización.
- **Modelo de datos:** documentado `persons.campaign` y un modelo separado de
  `contact_pipelines`/`contact_stages`/`contact_pipeline_memberships`, con etapa inicial
  **"Cargadas"** y entrada automática de contactos importados.
- **Criterio clave:** el estado del embudo de contactos no se deriva de actividades; las
  actividades quedan como tareas/seguimientos.

### 2026-06-23 (45) — Fase 6.4: sistema interno de eventos de automatización
- **Runner de automatizaciones:** nuevo `src/server/services/automation-runner.ts` con
  `AUTOMATION_EVENT` (`automation/event`), emisión best-effort a Inngest, parseo
  defensivo del payload, helpers de diff por campo, `eventId` por evento y deduplicación
  de reintentos al crear `automation_runs`.
- **Inngest:** registrada la función `run-automations-for-event`, que recibe el evento,
  resuelve automatizaciones activas con el matcher de 6.3 y crea runs en estado
  `waiting` con snapshot del grafo, versión, `trigger_event`, contexto y log inicial.
  Las acciones reales quedan preparadas para 6.5.
- **Fuentes de eventos:** contactos, empresas y negocios emiten creado/actualizado/
  borrado y `field_changed`; negocios emite `deal_stage_changed`; inscripción manual en
  secuencias emite `sequence_enrolled`; tracking Gmail emite `email_opened` en la primera
  apertura; Gmail Sync emite `email_replied` al detectar respuestas.
- **Verificado** con script temporal `tsx` (borrado) contra la BD: una automatización
  activa por `field_changed(email)` crea una sola `automation_run` en `waiting`, conserva
  versión/eventId/payload y la segunda ejecución del mismo evento se deduplica.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (44) — Fase 6.3: disparadores (motor de coincidencia de eventos)
- **`src/server/services/automation-events.ts`**: tipo `AutomationEvent`
  (type/ownerId/entityType/entityId/payload), `triggerMatchesEvent` (matcher puro: tipo +
  filtros de entidad, etapa destino `payload.toStageId` y campo `payload.field`) y
  `findActiveAutomationsForEvent` (owner-aware; solo automatizaciones `active` con
  `triggerType` coincidente). Es la base de la 6.4.
- **Catálogo/validación:** `record_deleted` queda expuesto en el constructor y aceptado
  por Zod, alineando UI, validación y esquema con el roadmap.
- **Verificado** con script `tsx` temporal: matcher positivo/negativo por entidad,
  campo vigilado y etapa destino; `record_deleted` soportado; consulta owner-aware
  contra una automatización temporal activa (creada y eliminada en la prueba) devuelve
  solo matches reales.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

### 2026-06-23 (43) — Fase 6.2: constructor visual de automatizaciones
- **Catálogo** `src/lib/automations.ts`: disparadores (con entidad), tipos de nodo,
  acciones (con su campo de configuración: texto/etiqueta/secuencia/plantilla/etapa),
  operadores de condición y helpers (`createNode`, `describeNode`, `getTriggerMeta`…).
- **Validación** `src/lib/validations/automation.ts` (trigger, nodos, aristas, grafo y
  formulario). **Queries** `queries/automations.ts` (`listAutomations`,
  `getAutomation`+`ForOwner`, `listAutomationBuilderOptions`). **Acciones**
  `actions/automations.ts` (crear borrador, actualizar con `triggerType` denormalizado y
  bump de `version`, `setAutomationStatus` con guarda de disparador, borrar).
- **UI:** `/automations` (`AutomationsView`: tarjetas con estado/disparador/nº pasos,
  crear→editar, activar/pausar, eliminar) y editor `/automations/[id]`
  (`AutomationBuilder`): disparador configurable + nodos acción/espera/condición en
  secuencia, reordenables, con config por nodo. Se persiste en `trigger`/`graph`
  (aristas lineales; if/else real en 6.6). "Automatizaciones" deja de ser
  "próximamente" en la navegación.
- **Decisión:** editor de flujo **estructurado** (sin canvas drag-and-drop libre) para
  que sea mantenible y verificable sin headless (las normas del proyecto desaconsejan
  probar overlays/DnD en navegador headless).
- **Verificado**: round-trip con `getAutomationForOwner` (trigger + 3 nodos) por `tsx`
  (borrado) y render vía login de desarrollo de `/automations` (muestra la
  automatización y su disparador) y del editor (disparador, nodos y config de acción),
  sin overlays de error.
- `pnpm typecheck`, `pnpm lint` y `pnpm build` en verde.

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
