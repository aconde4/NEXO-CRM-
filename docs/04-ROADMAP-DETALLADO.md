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
- [x] **1.1** Migración: `organizations`, `persons`, `labels`, `entity_labels`,
      `activities`, `notes`, `activity_log` (con índices y relaciones). *(campos
      personalizados y `files` se añaden con sus funciones, 1.8/1.12.)*
- [x] **1.2** Server Actions CRUD de `organizations` con validación Zod.
- [x] **1.3** Server Actions CRUD de `persons`. *(email/teléfono únicos por ahora;
      múltiples valores más adelante.)*
- [x] **1.4** Listado de contactos con búsqueda (tabla propia). *(orden/paginación
      avanzada y filtros por etiqueta → cuando lleguen etiquetas 1.9.)*
- [x] **1.5** Vistas guardadas (saved views) de filtros. Barra de vistas en
      Contactos: guardar la combinación actual (búsqueda + etiqueta + orden),
      aplicarla con un clic y borrarla. Tabla `saved_views` (filtros en JSONB).
- [x] **1.6** Ficha de contacto: datos + edición (diálogo) + línea de tiempo.
- [x] **1.7** Listado y ficha de empresas (con sus contactos asociados).
- [x] **1.8** Motor de **campos personalizados** definidos por el usuario (texto,
      número, **monetario**, fecha, sí/no, selección, selección múltiple, URL) en
      contactos y empresas: UI en **Ajustes** (crear/editar/borrar), render dinámico
      en **fichas y formularios**, valores en `custom_fields` (JSONB), y **mapeo en la
      importación** + **columnas en la exportación**. Añadido **`trade_name` (nombre
      comercial)** de serie en empresas. → detalle en
      [`06-CAMPOS-Y-PERSONALIZACION.md`](06-CAMPOS-Y-PERSONALIZACION.md).
      *(Retomado como prioridad en 6.4b: filtros por campo, incluido "comienza por",
      sobre campos de serie, `campaign` y campos personalizados.)*
- [x] **1.9** Sistema de etiquetas con colores: crear, asignar/quitar (selector en
      la ficha), chips en el listado y **filtro por etiqueta**.
- [x] **1.10** Actividades/tareas: crear, completar, vencimiento, "pendientes de hoy".
      Tipos (tarea/llamada/reunión/email/vencimiento/comida), página `/activities`
      con filtros (Hoy/Pendientes/Hechas/Todas), panel en fichas de contacto/empresa,
      y agenda + contadores en el panel.
- [x] **1.11** Notas (compositor en la ficha). *(editor Tiptap enriquecido más tarde.)*
- [x] **1.12** Adjuntos de archivos (Supabase Storage). Tabla `files`, panel
      "Archivos" en fichas de contacto y empresa (subir hasta 10 MB, descargar con
      enlace firmado temporal, borrar), bucket privado y **degradación elegante** si
      Storage no está configurado. → alta del bucket + clave en
      [`SETUP.md`](SETUP.md) §2 ter.
- [x] **1.13** Importación **Excel (.xlsx) y CSV**: leer columnas, **mapearlas** a
      campos del CRM, vista previa y deduplicación por email. Asistente en
      `/contacts/import` (subir → mapear → previsualizar → resultado), auto-mapeo de
      cabeceras, creación de empresas al vuelo y dedupe (omitir/actualizar).
      *(Mapeo a campos personalizados, creables al vuelo, queda para cuando exista
      1.8.)*
- [x] **1.14** Exportación a CSV (RGPD + respaldo): contactos y empresas, respetando
      los filtros activos, con BOM UTF-8 (`/api/contacts/export`,
      `/api/organizations/export`).
- [x] **1.15** Registro en `activity_log` de las mutaciones (creado/editado/borrado/nota).

> **Estado Fase 1 (completa):** Contactos y Empresas operativos (crear/editar/borrar,
> buscar, fichas con contactos/notas/timeline) + **etiquetas** + **actividades/tareas**
> + **importación CSV/Excel con mapeo y dedupe** + **exportación CSV** + **campos
> personalizados** (Ajustes, fichas, formularios, import/export) con `trade_name` de
> serie + **vistas guardadas** y orden en Contactos + **adjuntos** (Supabase Storage).
> Front pulido: **paleta de comandos (⌘K)**, skeletons, página 404, chips. Verificado
> vía login de desarrollo. La mejora de filtros por campo/prefijo ya no es opcional:
> queda priorizada en 6.4b. Para subir archivos hay que activar Storage
> (`SETUP.md` §2 ter).

### Criterios de aceptación
- Importas un CSV de contactos, los ves en una tabla filtrable, abres una ficha,
  editas campos (incluido uno personalizado), registras una actividad y una nota.
- Las empresas muestran sus contactos. Todo desplegado.

---

## FASE 2 · Pipeline / Embudos / Negocios  ← FIN DEL MVP PRIORITARIO

**Objetivo:** embudo visual Kanban con arrastrar y soltar, múltiples pipelines y
previsión. Completa tu prioridad declarada (Contactos + Pipeline).

### Tareas
- [x] **2.1** Migración: `pipelines`, `stages`, `deals`, `deal_contacts` (migración
      `0004`, con índices y relaciones).
- [x] **2.2** CRUD de pipelines y etapas (UI en Ajustes): nombre, orden (subir/bajar),
      probabilidad, días de estancamiento. Bloquea borrar el último embudo/etapa o con
      negocios.
- [x] **2.3** Server Actions de `deals` (crear/editar/borrar, mover de etapa con
      reordenación, marcar ganado/perdido con motivo, reabrir) + `activity_log`.
- [x] **2.4** Tablero Kanban con **dnd-kit**: columnas = etapas, tarjetas = negocios,
      arrastrar entre etapas actualiza `stage_id` y `stage_changed_at` (estado
      optimista + reordenación dentro de la columna).
- [x] **2.5** Selector de embudo (varios pipelines) y creación rápida de negocio
      (botón general y "+" por columna). Acción "Nuevo negocio" en ⌘K.
- [x] **2.6** Ficha de negocio (`/deals/[id]`): valor, etapa, embudo, contacto/empresa,
      propietario, cierre previsto, estado (+ motivo si perdido), panel de **tareas** y
      de **notas**. Acciones: editar, ganado/perdido (con motivo), reabrir, eliminar.
      Actividades y notas ahora pueden colgar de un negocio (`deal_id`, migración `0005`).
- [x] **2.7** Vincular negocios con contactos (participantes, `deal_contacts`): panel
      en la ficha para añadir/quitar personas con un rol opcional.
- [x] **2.8** Indicador de "estancado" (rotting) según `rotting_days` (borde y aviso).
- [x] **2.9** Resumen por columna: nº de negocios y suma de valor por etapa.
- [x] **2.10** Vista de lista de negocios (alternativa al Kanban) con filtros:
      `/deals?view=list`, búsqueda por negocio/contacto/empresa, filtros por
      embudo, etapa y estado, ordenación, resumen visible y acciones por fila.
- [x] **2.11** Previsión ponderada (valor × probabilidad de etapa) en la cabecera.

> **Estado Fase 2 (completa):** Kanban operativo (arrastrar entre etapas,
> crear/editar/borrar, ganado/perdido con motivo), varios embudos con selector,
> gestión de embudos/etapas en Ajustes, totales por columna y previsión ponderada,
> indicador de estancado, **ficha de negocio** con tareas/notas y **participantes**,
> y **vista de lista** con búsqueda, filtros por embudo/etapa/estado, ordenación,
> resumen y acciones por fila. Verificado vía login de desarrollo (render, totales,
> previsión, ficha + nota + participantes end-to-end, lista y filtros por URL; el
> arrastre dnd no se prueba en headless).

### Criterios de aceptación
- Creas un negocio, lo arrastras entre etapas, lo marcas ganado/perdido, ves el total
  por columna y una previsión. Funciona con 2+ pipelines. Desplegado.
- 🎉 **Hito:** ya tienes un CRM usable a diario para gestionar tu cartera.

---

## FASE 3 · Email 1:1 (integración Gmail)

**Objetivo:** enviar y recibir correos desde dentro del CRM, vinculados a contactos y
negocios, con plantillas y seguimiento de aperturas/clics.

### Tareas
- [x] **3.1** Ampliar OAuth de Google con scopes de Gmail (envío + lectura).
      → scopes `gmail.send` + `gmail.readonly`, acceso offline/incremental,
      persistencia segura de tokens/scopes y panel de conexión en `/inbox`.
- [x] **3.2** Migración: `mailboxes`, `email_threads`, `email_messages`,
      `email_templates`, `email_events`. → `0006_exotic_prism`: ownership por
      usuario, buzones Gmail sin duplicar tokens OAuth, hilos vinculables a
      contacto/empresa/negocio, mensajes con IDs de Gmail/RFC, plantillas y eventos
      de tracking/webhook.
- [x] **3.3** Servicio Gmail: enviar correo (con hilo correcto) usando el refresh
      token guardado. → MIME RFC 2822/base64url, refresh de access token,
      `users.messages.send`, `threadId` + `In-Reply-To`/`References`, límite diario
      del buzón y persistencia en `email_threads`/`email_messages`/`email_events`.
- [x] **3.4** Sincronización de entrada: leer mensajes nuevos (Gmail history API o
      polling vía Inngest) y vincularlos al contacto por email. → Job Inngest cada
      10 min + acción manual, full sync inicial acotado, sync incremental con
      `history.list`, recuperación si caduca el cursor, persistencia idempotente y
      vínculo a contacto/empresa por email del remitente.
- [x] **3.5** Vista de hilo de conversación en la ficha del contacto/negocio. Panel
      "Conversaciones" en fichas de contacto, empresa y negocio (lista de hilos por
      `person_id`/`org_id`/`deal_id`) y página `/inbox/[threadId]` con los mensajes en
      orden cronológico (Enviado/Recibido). Cuerpo HTML→texto por seguridad (sin XSS).
- [x] **3.6** Redactor de email (Tiptap) con plantillas y **merge tags**: variables
      de **campos de serie + personalizados** del contacto y su empresa
      (`{{nombre}}`, `{{empresa.nombre_comercial}}`, `{{ingresos}}`…), con **valor por
      defecto** (`{{nombre|"amigo"}}`) y **vista previa por destinatario**. Este motor
      lo reutilizan campañas (Fase 4) y secuencias (Fase 5) para personalizar cada
      envío. → [`06-CAMPOS-Y-PERSONALIZACION.md`](06-CAMPOS-Y-PERSONALIZACION.md).
- [x] **3.7** Tracking de aperturas (pixel propio) y de clics (redirección propia)
      → `email_events`. Cada mensaje saliente tiene `tracking_id`, pixel de apertura,
      enlaces HTTP/HTTPS reescritos a redirecciones firmadas, eventos `open`/`click`,
      contadores en `email_messages` y métricas visibles en `/inbox/[threadId]`.
- [x] **3.8** Bandeja de ventas unificada (todos los hilos en un sitio). `/inbox`
      muestra los hilos sincronizados con búsqueda, filtros (todos/no leídos/
      vinculados/sin vincular), orden reciente/antiguo, contadores y acceso directo a
      `/inbox/[threadId]`.
- [x] **3.9** Detección de respuestas (marca `replied`) — base para parar secuencias.
      Al sincronizar, un mensaje entrante que responde a un saliente del hilo
      (match por `In-Reply-To`/`References`, con fallback al último saliente sin
      responder) marca `email_messages.replied_at`, registra un evento `reply` y un
      apunte en `activity_log`. La conversación muestra "Respondido" en el saliente.
- [x] **3.10** Límite diario de envío por buzón (warm-up) y firma HTML. El servicio
      de envío respeta `daily_limit` (reset a medianoche UTC, bloqueo y contador
      `sent_today`); la **firma HTML** del buzón se añade al final de cada email
      (HTML + texto). Ajustes en **Ajustes → Correo (Gmail)**: límite diario, firma
      (saneada al guardar) y uso de hoy.

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
- [x] **4.2** Migración: `campaigns`, `campaign_recipients`, `segments`,
      `suppressions`.
- [x] **4.3** Servicio Resend: envío individual y por lotes.
- [x] **4.4** Constructor de segmentos por filtros (reutiliza el motor de filtros de
      la Fase 1); previsualización del tamaño de audiencia.
- [x] **4.5** Editor de campaña con React Email (bloques) + envío de prueba.
- [x] **4.6** Programación de envío y troceado en lotes vía Inngest (respetar límites
      y ventana horaria).
- [x] **4.7** Gestión de bajas: página pública de unsubscribe + cabecera
      `List-Unsubscribe` + comprobación de `suppressions` antes de enviar.
- [x] **4.8** Webhooks de Resend: entregas, aperturas, clics, rebotes, quejas →
      `email_events` y actualización de `marketing_status`.
- [x] **4.9** Panel de resultados de campaña (enviados/abiertos/clics/rebotes/bajas).
- [x] **4.10** Consentimiento/origen y pie RGPD con datos del remitente.

### Criterios de aceptación
- Creas un segmento, diseñas una campaña, envías una prueba, programas el envío real,
  el destinatario puede darse de baja y ves las métricas. Nadie de la lista de
  supresión recibe nada. Desplegado.

---

## FASE 5 · Secuencias / Drip

**Objetivo:** inscribir contactos en secuencias multi-paso con esperas, condiciones y
parada automática al responder. El diferenciador frente a Pipedrive Campaigns.

### Tareas
- [x] **5.1** Migración: `sequences`, `sequence_steps`, `enrollments`.
- [x] **5.2** Constructor de secuencias: pasos email/espera/condición/tarea, orden,
      días de espera, canal (Gmail 1:1 o Resend).
- [x] **5.3** Workflow duradero en Inngest: ejecutar pasos con `step.sleep` (esperas
      de días) y `waitForEvent` (esperar respuesta/apertura).
- [x] **5.4** Inscripción manual (desde un contacto o un filtro/segmento).
- [x] **5.5** Parada automática al responder/rebote/baja (`stop on reply`).
- [x] **5.6** Límite diario por buzón y ventana de envío aplicados a las secuencias.
- [x] **5.7** Variantes A/B por paso de email.
- [x] **5.8** Panel de la secuencia: inscritos, paso actual, tasas de apertura/
      respuesta, bajas.

### Criterios de aceptación
- Inscribes contactos en una secuencia de 3 pasos (email → espera 3 días → si no
  respondió, email 2). Al responder uno, su secuencia se detiene sola. Desplegado.

---

## FASE 6 · Motor de automatizaciones

**Objetivo:** constructor visual de automatizaciones (disparador → condiciones →
esperas → acciones) más potente que la lista lineal de Pipedrive.

### Tareas
- [x] **6.1** Migración: `automations`, `automation_runs`.
- [x] **6.2** Canvas visual de nodos (disparador, condición if/else, espera, acción).
- [x] **6.3** Disparadores: registro creado/actualizado/borrado, cambio de etapa,
      cambio de campo, email abierto/respondido, formulario enviado, programado.
- [x] **6.4** Sistema de eventos interno: las mutaciones emiten eventos a Inngest.
- [x] **6.4a** Corrección de modelo comercial antes de seguir: `campaign` debe ser un
      campo **nativo** de contacto (campaña/origen comercial de carga), con migración,
      formulario, ficha, listado, exportación y auto-mapeo desde Excel/CSV. No confundir
      con `campaigns` de email masivo.
- [x] **6.4b** Filtros profesionales de contactos por campo: selector de campo
      (nombre, email, teléfono, cargo, empresa, origen, **campaña**, estado marketing y
      campos personalizados) + operador **"comienza por"** para buscar por prefijo.
      Debe integrarse en Contactos, vistas guardadas y superficies que reutilicen la
      audiencia (segmentos/embudo de contactos cuando aplique).
      UX objetivo inspirada en Pipedrive: barra superior con chips de condiciones activas
      (ej. `Campaña empieza por 005`) con botón de borrar, botón **Añadir condición**,
      **Limpiar** y **Guardar vista**. El selector de condición debe tener búsqueda,
      sugerencias y campos agrupados por entidad (**Contacto**, **Empresa** y, donde
      aplique, Actividad/Negocio), con operadores legibles (`comienza por`, `contiene`,
      `es`, `tiene valor`, `está vacío`). Debe soportar varias condiciones combinadas en
      AND y mantener el estado en URL para compartir/guardar vistas.
- [x] **6.4c** Embudo de **contactos/prospección** basado en contactos, no en
      actividades: modelo propio de pipeline/etapas de contacto, etapa inicial
      **"Cargadas"**, importación Excel/CSV que mete los nuevos contactos en esa etapa,
      tablero que muestra **todos los contactos cargados** y movimiento manual entre
      etapas. Las actividades quedan como tareas/seguimientos, no como el estado del
      embudo.
      UX objetivo: tablero horizontal tipo pipeline con columnas configurables
      (`Cargadas`, `Contactadas`, `Follow-up 1`, etc.), contador de contactos por etapa
      y scroll horizontal profesional. Cada tarjeta representa **un contacto**: título
      principal = empresa vinculada (`trade_name`/`name`); segunda línea = nombre del
      contacto; si no hay empresa, el título será el contacto y la segunda línea mostrará
      "Sin empresa" o el email. Si hay varios contactos de la misma empresa, aparecen
      como varias tarjetas con el mismo título de empresa y distinto contacto debajo.
      La tarjeta debe mostrar también campaña/origen cuando ayude a filtrar, y permitir
      arrastrar entre etapas sin crear actividades. Los contactos existentes deben poder
      incorporarse al embudo (backfill a `Cargadas` en el embudo por defecto) para que el
      tablero no empiece vacío.
- [x] **6.4d** Negocios con muchos embudos + filtros: filtros 6.4b en Kanban **y**
      Lista (acotan por contacto), `min-w-0` para que el tablero haga scroll sin cortar
      la página y selector de embudo acotado. *(Opcional pendiente: selector combobox
      con buscador si crecen mucho los embudos — recogido en 6.4f.)*

#### Mejoras del embudo de contactos habilitadas por 6.4 (propuestas 2026-06-23)
> Estas opciones se abren tras convertir Negocios en el embudo de contactos + filtros.
> Priorizar con el usuario; no bloquean 6.5–6.8.
- [ ] **6.4e** "Cargar contactos" **respetando el filtro activo**: el backfill mete solo
      los contactos que cumplen el filtro actual (hoy mete todos los que no estén en
      ningún embudo). Útil para cargar por campaña/segmento concreto.
- [ ] **6.4f** Selector de embudo tipo **combobox con buscador** (cierre fino de 6.4d) y
      recordar el último embudo abierto.
- [ ] **6.4g** **Acciones masivas** en el tablero: seleccionar varias tarjetas →
      mover de etapa, añadir etiqueta, inscribir en secuencia o quitar del embudo.
- [ ] **6.4h** **Vistas guardadas** del embudo (reusar `saved_views`) y filtro por
      **etapa/embudo** como criterio (cross con 6.4b).
- [ ] **6.4i** **Métricas del embudo** (estilo panel de secuencia): nº y % de conversión
      entre etapas, estancados por etapa, por campaña. (Adelanta parte de Fase 9.)
- [ ] **6.4j** **Sincronía con automatizaciones**: plantillas de automatización "al
      entrar en etapa X → inscribir en secuencia / crear tarea" (se apoya en
      `deal_stage_changed`, ya emitido). Encaja al cerrar 6.5–6.6.
- [x] **6.5** Acciones (ejecución real): `create_task`, `add_label`, `move_stage`,
      `update_field` (custom field), `enroll_sequence`, `webhook` y `notify` ejecutadas
      por `automation-executor.ts` desde `run-automations-for-event` (idempotente por
      `waiting`→`running`→`completed/failed`, con log por nodo). *Pendiente: `send_email`
      (necesita remitente/plantilla/transporte) y `ai_summary` (Fase 8); registran traza
      "pendiente".*
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
