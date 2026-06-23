# 02 · Modelo de Datos

Diseño de entidades para PostgreSQL (vía Drizzle). Pensado para cubrir todo el CRM
sin rehacer el esquema más adelante. Convenciones:

- Toda tabla tiene `id` (uuid), `created_at`, `updated_at`.
- `owner_id` apunta al usuario propietario (preparado para multiusuario futuro,
  aunque al inicio seas solo tú).
- Campos flexibles → `JSONB` (`custom_fields`) para no migrar cada vez que añadas un
  campo personalizado.
- Borrados → `deleted_at` (soft delete) en entidades importantes.

---

## 1. Identidad y configuración

### `users`
Usuarios de la app (al inicio, solo tú). `id`, `email`, `name`, `image`,
`role` (`owner`/`member`), timestamps. (Auth.js gestiona sesiones/cuentas.)

### `accounts` / `sessions` / `verification_tokens`
Tablas estándar de Auth.js. En `accounts` guardamos el **refresh_token de Google**
para llamar a la Gmail API.

### `mailboxes`
Buzones conectados para envío 1:1. `owner_id`, `provider` (`gmail`), `email`,
`email_normalized`, `display_name`, `from_name`, `status`, vínculo a la cuenta OAuth
(`account_provider`, `account_provider_account_id`), `gmail_history_id`,
`last_synced_at`, `last_sync_started_at`, `last_sync_error`, `daily_limit`
(warm-up), `sent_today`, `sent_today_reset_at`, `signature_html`, `settings`.
Los tokens OAuth **no se duplican aquí**: siguen en `accounts` (Auth.js).

### `settings`
Ajustes globales del workspace: zona horaria, horario de envío permitido (sending
window), datos del remitente para RGPD (dirección física en el pie), etc.

---

## 2. CRM nuclear (Fases 1–2)

### `organizations` (empresas)
`name` (nombre **legal**), `trade_name` (nombre **comercial**, de serie), `domain`,
`website`, `phone`, `address`, `industry`, `size`, `owner_id`,
`custom_fields` (JSONB), `deleted_at`.

### `persons` (contactos)
`first_name`, `last_name`, `org_id` (→ organizations), `title` (cargo),
`emails` (JSONB: lista con etiqueta work/home + flag de baja),
`phones` (JSONB), `owner_id`, `source` (origen del lead),
`campaign` (campaña/origen comercial de la carga, campo nativo filtrable),
`marketing_status` (`subscribed`/`unsubscribed`/`bounced`/`complained`),
`custom_fields` (JSONB), `deleted_at`.

### `labels` (etiquetas/segmentos rápidos)
`name`, `color`, `entity_type` (`person`/`org`/`deal`). Tabla puente
`entity_labels` (polimórfica) para asignaciones N:N.

### `custom_field_defs`
Definición de campos personalizados: `entity_type`, `key`, `label`,
`type` (`text`/`number`/`date`/`select`/`multiselect`/`checkbox`/`url`/`monetary`),
`options` (JSONB), `order`, `required`. Los **valores** viven en el `custom_fields`
JSONB de cada entidad. Estos campos se usan también como **variables (merge tags)**
en correos de secuencias y campañas — ver
[`06-CAMPOS-Y-PERSONALIZACION.md`](06-CAMPOS-Y-PERSONALIZACION.md).

### `pipelines`
Embudos. `name`, `order`, `is_default`.

### `stages` (etapas)
`pipeline_id`, `name`, `order`, `probability` (% para previsión ponderada),
`rotting_days` (días para marcar un negocio como "estancado").

### `deals` (negocios)
`title`, `value`, `currency`, `pipeline_id`, `stage_id`, `org_id`, `person_id`
(contacto principal), `owner_id`, `status` (`open`/`won`/`lost`),
`expected_close_date`, `won_at`, `lost_at`, `lost_reason`,
`stage_changed_at` (para detectar estancamiento), `custom_fields` (JSONB).

### `deal_contacts`
Participantes de un negocio (N:N entre deals y persons) con `role`.

### `contact_pipelines` / `contact_stages` / `contact_pipeline_memberships`
Embudo de **contactos/prospección**, separado del pipeline de negocios. Sirve para ver
y mover contactos por estados comerciales antes de que exista un negocio. No se basa en
actividades.

- `contact_pipelines`: `owner_id`, `name`, `order`, `is_default`.
- `contact_stages`: `contact_pipeline_id`, `name`, `order`, `color`, `is_initial`.
  Debe existir una etapa inicial por defecto llamada **"Cargadas"**.
- `contact_pipeline_memberships`: `owner_id`, `person_id`, `contact_pipeline_id`,
  `contact_stage_id`, `position`, `entered_stage_at`, `source` (`import`/`manual`/
  `automation`), `created_at`, `updated_at`. Índice único por
  `contact_pipeline_id + person_id`.

La importación Excel/CSV debe crear o actualizar contactos y asegurar que los nuevos
queden visibles en el embudo por defecto, etapa **"Cargadas"**. Las actividades siguen
representando tareas/seguimientos, no el estado del embudo.

### `products` *(opcional, Fase 10)*
Catálogo: `name`, `code`, `unit_price`, `currency`, `tax`. Tabla `deal_products`
(líneas de un negocio: cantidad, precio, descuento) para presupuestos.

---

## 3. Actividades y notas (Fase 1)

### `activities`
`type` (`call`/`meeting`/`task`/`email`/`deadline`/`lunch`...), `subject`,
`notes`, `due_at`, `duration`, `done` (bool), `done_at`,
`person_id`, `org_id`, `deal_id` (cualquiera puede ser null), `owner_id`.

### `notes`
`body` (rich text), `person_id`/`org_id`/`deal_id`, `owner_id`.

### `files`
Adjuntos (Supabase Storage): `name`, `url`, `size`, `mime`, enlace a entidad.

### `activity_log` (timeline / auditoría)
Eventos del sistema para la línea de tiempo de cada ficha y auditoría:
`actor_id`, `verb` (`created`/`updated`/`stage_changed`/`emailed`...),
`entity_type`, `entity_id`, `payload` (JSONB), `created_at`.

---

## 4. Email (Fases 3–4)

### `email_threads`
Hilos sincronizados: `mailbox_id`, `provider_thread_id` (Gmail thread id),
`subject`, `snippet`, `status`, `person_id`, `org_id`, `deal_id`,
`last_message_at`, `last_inbound_at`, `last_outbound_at`, `message_count`,
`unread`, `provider_labels`, `metadata`, `deleted_at`.

### `email_messages`
Mensajes individuales: `mailbox_id`, `thread_id`, `provider`,
`provider_message_id`, `provider_thread_id`, `rfc_message_id`, `in_reply_to`,
`references_header`, `direction` (`inbound`/`outbound`), `status`, `from_email`,
`from_name`, destinatarios en JSONB (`to_recipients`, `cc_recipients`,
`bcc_recipients`, `reply_to_recipients`), `subject`, `snippet`, `body_html`,
`body_text`, `attachments`, `headers`, `sent_at`, `received_at`, `tracking_id`,
`opened_at`, `clicked_at`, `replied_at`, `bounced_at`, contadores de apertura/clic y
`metadata`.

### `email_templates`
Plantillas reutilizables: `name`, `subject`, `body_html`, `variables` (merge tags
como `{{first_name}}`), `category`, `archived_at`.

### `email_events`
Eventos crudos de tracking/webhooks: `message_id`, `type`
(`queued`/`sent`/`delivered`/`open`/`click`/`bounce`/`complaint`/`unsubscribe`/
`reply`/`sync`), `mailbox_id`, `provider`, `provider_event_id`, `recipient_email`,
`tracking_id`, `url`, `ip_address`, `user_agent`, `meta` (JSONB), `occurred_at`,
`created_at`. Alimenta las métricas.

### `suppressions` (lista de supresión global — RGPD)
`email`, `reason` (`unsubscribe`/`bounce`/`complaint`/`manual`), `created_at`.
**Antes de cualquier envío masivo se comprueba aquí.**

---

## 5. Campañas (Fase 4)

### `campaigns`
`name`, `subject`, `from_name`, `from_email`, `body_html` (o referencia a plantilla),
`status` (`draft`/`scheduled`/`sending`/`sent`/`paused`),
`scheduled_at`, `segment_id` (audiencia), `provider` (`resend`),
`stats` (JSONB: enviados, entregados, aperturas, clics, rebotes, bajas).

### `campaign_recipients`
`campaign_id`, `person_id`, `email`, `status`
(`pending`/`sent`/`delivered`/`opened`/`clicked`/`bounced`/`unsubscribed`),
`sent_at`, `message_id`.

### `segments` (audiencias)
`name`, `definition` (JSONB con filtros: p.ej. "etiqueta = cliente AND país = ES").
Pueden ser dinámicos (se recalculan) o estáticos.

---

## 6. Secuencias / Drip (Fase 5)

### `sequences`
Tabla creada en la migración `0008_flowery_peter_parker`. Campos principales:
`owner_id`, `name`, `description`, `status` (`draft`/`active`/`paused`/`archived`),
`channel` (`gmail_1to1`/`resend`), `stop_on_reply`, `daily_limit`, `window_start`,
`window_end`, `time_zone`, `settings` (JSONB para opciones avanzadas).

### `sequence_steps`
Tabla creada en la migración `0008_flowery_peter_parker`. Campos principales:
`owner_id`, `sequence_id`, `position`, `type` (`email`/`wait`/`condition`/`task`),
`name`, `channel`, `wait_days`, `wait_hours`, `template_id`, `subject`, `preheader`,
`body_html`, `body_text`, `condition` (JSONB), `variants` (JSONB para A/B) y
`settings` (JSONB). Índice único por `sequence_id + position`.

### `enrollments` (inscripciones)
Tabla creada en la migración `0008_flowery_peter_parker`. Campos principales:
`owner_id`, `sequence_id`, `person_id`, vínculos opcionales `org_id`/`deal_id`,
`current_step_id`, `current_step_position`, `status`
(`active`/`paused`/`completed`/`stopped`/`bounced`/`replied`/`unsubscribed`/`failed`),
`stop_reason`, `inngest_run_id`, `last_message_id`, `last_event_at`, `last_error`,
`retry_count`, `enrolled_at`, `next_run_at`, `completed_at`, `stopped_at` y
`context` (JSONB para variantes, contadores y trazabilidad). Índice único por
`sequence_id + person_id`.

---

## 7. Automatizaciones (Fase 6)

### `automations`
`name`, `enabled` (bool), `trigger` (JSONB: tipo + config),
`graph` (JSONB: nodos y aristas del canvas visual), `version`.

### `automation_runs` (registro de ejecuciones)
`automation_id`, `entity_type`, `entity_id`, `status`
(`running`/`completed`/`failed`/`waiting`), `log` (JSONB pasos ejecutados),
`started_at`, `finished_at`. Observabilidad de qué hizo cada automatización.

**Disparadores soportados:** registro creado/actualizado/borrado, negocio cambia de
etapa, cambia un campo concreto, email abierto/respondido, formulario enviado,
programado (cron), inscripción a secuencia.

**Acciones soportadas:** crear/actualizar registro, enviar email, inscribir en
secuencia, crear actividad/tarea, añadir etiqueta, mover de etapa, llamar webhook,
notificar (Slack/email), **acción de IA** (p.ej. "resume y puntúa este lead").

---

## 8. Captación (Fase 7)

### `forms`
`name`, `fields` (JSONB), `redirect_url`, `embed_settings`, `mappings`
(qué campo del formulario va a qué campo de persona/negocio), `automation_id`
(qué disparar al recibir).

### `form_submissions`
`form_id`, `data` (JSONB), `person_id` (creado/encontrado), `ip`, `created_at`.

### `leads`
Bandeja previa a negocio: `person_id`, `source`, `status`
(`new`/`qualified`/`converted`/`junk`), `score`, `converted_deal_id`.

---

## 9. IA (Fase 8)

### `ai_runs`
Trazas de uso de Claude: `feature` (`draft`/`summary`/`score`/`nl_automation`...),
`input` (resumen), `output`, `model`, `tokens`, `cost`, `created_at`. Para control
de gasto y depuración.

### Campos derivados de IA
- `persons.score` / `leads.score` (lead scoring).
- `deals.ai_summary`, `deals.next_best_action`.
- `email_messages.sentiment` (en respuestas).

---

## 10. Diagrama de relaciones (alto nivel)

```
organizations 1───* persons 1───* deals *───1 stages *───1 pipelines
      │               │            │
      │               │            └──* activities / notes / files / email_threads
      │               ├──* contact_pipeline_memberships *── contact_stages
      │               └──* enrollments ─* sequences ─* sequence_steps
      └──* deals
persons *──* labels (entity_labels)        campaigns 1──* campaign_recipients
persons 1──* email_messages                segments 1──* campaigns
automations 1──* automation_runs           forms 1──* form_submissions ─* leads
suppressions (global)                      ai_runs (transversal)
```

> Este esquema es el **objetivo**. No se crea entero en la Fase 1: cada fase añade
> solo sus tablas. Pero diseñarlo completo ahora evita rehacer relaciones después.

---

➡️ Siguiente lectura: [`03-PARIDAD-PIPEDRIVE-Y-MEJORAS.md`](03-PARIDAD-PIPEDRIVE-Y-MEJORAS.md)
