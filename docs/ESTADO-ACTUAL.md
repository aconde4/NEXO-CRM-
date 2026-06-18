# ESTADO ACTUAL · (archivo vivo)

> **Este es el primer archivo que se lee al retomar el proyecto.** Indica exactamente
> dónde estamos y qué hacer a continuación. Se actualiza al final de cada sesión y
> al terminar cada tarea.

---

## 📍 Dónde estamos

- **Fase 0 · Fundaciones:** completa (queda solo el despliegue opcional). Login con
  Google verificado por el usuario ("funciona").
- **Fase 3 · Email 1:1 (Gmail):** iniciada — **3.1 completa**. OAuth de Google pide
  `gmail.send` + `gmail.readonly`, con acceso offline e incremental; Auth.js
  conserva/actualiza tokens y scopes en `account`; `/inbox` muestra el estado seguro
  de conexión Gmail sin exponer tokens. Siguiente: modelo de datos de email.
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

**Fase 3 iniciada.** Continúa la **FASE 3 · Email 1:1 (integración Gmail)** en
[`04-ROADMAP-DETALLADO.md`](04-ROADMAP-DETALLADO.md) por la primera tarea sin marcar:
1. **3.2** Migración: `mailboxes`, `email_threads`, `email_messages`,
   `email_templates`, `email_events`.

Tareas opcionales que quedaron fuera de la Fase 1 (retomar cuando convenga):
- Columnas y **filtros por campo personalizado** en los listados (sobre las vistas
  guardadas). Etiquetas también en empresas; editor de notas enriquecido (Tiptap).

> **Para activar adjuntos:** crear el bucket `attachments` y añadir
> `SUPABASE_SERVICE_ROLE_KEY` (ver `SETUP.md` §2 ter).

> **Hecho en la última sesión:** Fase 3.1 — OAuth Google ampliado con scopes Gmail
> (`gmail.send` + `gmail.readonly`), persistencia de tokens/scopes y panel de conexión
> en `/inbox`. Antes: cierre de la Fase 2 con vista de lista de negocios.

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
