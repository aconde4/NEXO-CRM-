# 03 · Paridad con Pipedrive y Mejoras

Investigación de las funcionalidades reales de Pipedrive (incluidos sus add-ons de
pago) y cómo las cubrimos —o las superamos— en nuestro CRM.

## 1. Matriz de funcionalidades

Leyenda: ✅ incluido · 🔼 mejorado respecto a Pipedrive · 🆕 no existe en Pipedrive ·
💲 en Pipedrive es add-on de pago aparte.

| Área | Pipedrive | Nuestro CRM | Fase |
|---|---|---|---|
| **Gestión de contactos/empresas** | ✅ | ✅ | 1 |
| **Campos personalizados** | ✅ | ✅ (+ tipos monetarios, multiselect) | 1 |
| **Importación CSV con mapeo** | ✅ | ✅ + 🔼 deduplicación inteligente | 1 |
| **Actividades y tareas** | ✅ | ✅ | 1 |
| **Línea de tiempo / historial** | ✅ | ✅ | 1 |
| **Pipeline visual (Kanban)** | ✅ | ✅ | 2 |
| **Múltiples pipelines** | ✅ | ✅ | 2 |
| **Probabilidad por etapa / previsión ponderada** | ✅ | ✅ | 2 |
| **Detección de negocios estancados ("rotting")** | ✅ | ✅ | 2 |
| **Motivos de pérdida** | ✅ | ✅ | 2 |
| **Sincronización de email bidireccional** | ✅ | ✅ (Gmail API) | 3 |
| **Plantillas de email + merge tags** | ✅ | ✅ | 3 |
| **Seguimiento de aperturas y clics** | ✅ | ✅ | 3 |
| **Bandeja de ventas unificada** | ✅ (revamp 2026) | ✅ | 3 |
| **Campañas de email masivo** | 💲 add-on Campaigns | ✅ incluido | 4 |
| **Segmentación de audiencias** | 🔼 limitada en Campaigns | 🔼 segmentos dinámicos por filtros | 4 |
| **Gestión de bajas / RGPD / supresión** | ✅ básica | 🔼 lista de supresión global + doble opt-in | 4 |
| **Secuencias / drip con esperas** | parcial (vía automations) | 🔼 secuencias dedicadas con parada al responder | 5 |
| **A/B testing de email** | 💲 limitado | ✅ variantes por paso | 5 |
| **Automatizaciones (disparador→condición→acción)** | ✅ (lista lineal) | 🔼 **canvas visual** con ramas if/else y esperas | 6 |
| **Disparadores por cambio de campo / etapa** | ✅ | ✅ | 6 |
| **Webhooks / integraciones (Slack, Teams...)** | ✅ | ✅ (webhooks + Slack) | 6 |
| **Formularios web / captación de leads** | 💲 add-on LeadBooster | ✅ incluido | 7 |
| **Chatbot / Live chat** | 💲 LeadBooster | ⏳ posible más adelante | 10 |
| **Prospección de leads (Prospector)** | 💲 LeadBooster | ⏳ fuera de alcance inicial | — |
| **Web Visitors (tracking de visitantes)** | 💲 add-on | ⏳ opcional | 10 |
| **Documentos y firma electrónica** | 💲 add-on Smart Docs | ✅ planificado | 10 |
| **Productos y presupuestos** | ✅ | ✅ planificado | 10 |
| **Ingresos recurrentes** | ✅ | ⏳ opcional | 10 |
| **Reporting / dashboards / objetivos** | ✅ | ✅ | 9 |
| **App móvil** | ✅ nativa | 🔼 PWA responsive (instalable) | 10 |
| **IA de ventas** | ✅ asistente básico | 🆕 **Claude integrado en todo el flujo** | 8 |

## 2. Nuestras mejoras clave (el "mejor que Pipedrive")

### 🆕 1. IA (Claude) integrada de extremo a extremo
No un "asistente" superficial, sino IA útil en cada pantalla:
- **Redacción y respuestas** de correos en tu tono.
- **Resumen del historial** de un contacto/negocio en 3 líneas.
- **Crear secuencias y automatizaciones por lenguaje natural**: «crea una secuencia
  de 3 correos para reactivar clientes inactivos» → genera los pasos.
- **Lead scoring** automático y **siguiente mejor acción** por negocio.
- **Análisis de sentimiento** de las respuestas para priorizar.

### 🔼 2. Email unificado y sin paywalls
Pipedrive te cobra Campaigns, LeadBooster y Smart Docs por separado. Aquí, las
**secuencias 1:1 (Gmail) y las campañas masivas (Resend) conviven** en una sola
herramienta, y los formularios y la firma vienen incluidos.

### 🔼 3. Motor de automatización superior
Pipedrive usa una **lista lineal** de pasos. Nosotros: **canvas visual con
ramificaciones** (if/else), esperas reales, esperar-a-evento (p.ej. "espera hasta
que responda o 3 días") y un **registro de ejecuciones** para ver exactamente qué
hizo cada automatización. Construido sobre Inngest (workflows duraderos), así que
las esperas de días/semanas son fiables.

### 🔼 4. Mejor entregabilidad por diseño
Límite diario por buzón (warm-up), ventana horaria de envío, detección de respuestas
para parar secuencias, lista de supresión global y separación clara entre correo
personal (Gmail) y masivo (dominio dedicado con SPF/DKIM/DMARC).

### 🆕 5. Propiedad total y coste ~0
Tus datos en tu base de datos. Exportación completa cuando quieras. Sin límites
artificiales de contactos ni de "asientos". Coste casi nulo al inicio.

### 🔼 6. RGPD nativo (estás en la UE)
Consentimiento, doble opt-in opcional, `List-Unsubscribe`, derecho de supresión y
export, y pie con datos del remitente. Pensado para España/UE desde el inicio.

## 3. Ideas extra (backlog, no comprometidas)

- **Optimización de hora de envío** por contacto (cuándo abre normalmente).
- **Bandeja unificada multicanal** (email + WhatsApp/SMS) — Fase 10.
- **Plantillas de pipeline** y automatizaciones predefinidas listas para usar.
- **"Spintax"/variaciones** en correos de secuencia para mejorar entregabilidad.
- **Enriquecimiento de contactos** (dominio → datos de empresa).
- **Detección de duplicados** continua, no solo en la importación.

## 4. Fuentes de la investigación

- [Pipedrive — Workflow Automation (oficial)](https://www.pipedrive.com/en/features/workflow-automation)
- [Pipedrive — Automations: primeros pasos (KB)](https://support.pipedrive.com/en/article/workflow-automation)
- [Pipedrive — Automations basadas en condiciones de email (KB)](https://support.pipedrive.com/en/article/automations-email-conditions)
- [Cómo usar Pipedrive para marketing automation — Salespanel](https://salespanel.io/blog/marketing/pipedrive-marketing-automation/)
- [Pipedrive Review 2026 — Research.com](https://research.com/software/reviews/pipedrive-review)
- [Pipedrive Pricing 2026 y add-ons — Lindy](https://www.lindy.ai/blog/pipedrive-pricing)
- [5 New Pipedrive Features (April 2026) — minorco](https://minorco.com/blog/5-pipedrive-updates/)

---

➡️ Siguiente lectura: [`04-ROADMAP-DETALLADO.md`](04-ROADMAP-DETALLADO.md)
