# 08 · Email, Resend y redacción comercial

> Documento de producto para la fase transversal de comunicación comercial. Sirve para
> que cualquier asistente entienda cómo se separan Gmail 1:1, Resend masivo, campañas,
> secuencias, automatizaciones y la futura pantalla global de redacción.

---

## 1. Cómo funciona Resend en Nexo CRM

**Resend no sustituye a Gmail.** En Nexo CRM hay dos transportes de correo:

- **Gmail 1:1:** se usa para correos personales desde tu buzón real. Sirve para
  responder hilos, enviar desde fichas y mantener conversación natural. Está limitado por
  el buzón y por el warm-up (`mailboxes.daily_limit`).
- **Resend masivo:** se usa para campañas, newsletters, secuencias de volumen y cualquier
  envío donde importa entregabilidad, bajas, rebotes, quejas y métricas. Envía desde un
  dominio verificado, no desde una sesión OAuth de Gmail.

### Flujo real de una campaña con Resend

1. El usuario crea/verifica un dominio en Resend.
2. Resend da registros DNS: SPF, DKIM, MX de rebotes y DMARC recomendado.
3. El usuario copia `RESEND_API_KEY`, remitente (`CAMPAIGN_FROM_EMAIL`) y webhook secret
   (`RESEND_WEBHOOK_SECRET`) en `.env.local` y en Vercel cuando haya despliegue.
4. En Nexo CRM se crea un segmento: filtros de contactos, campaña/origen, etiquetas,
   campos personalizados, estado de marketing, etc.
5. En `/campaigns` se diseña la campaña con bloques, merge tags y datos RGPD.
6. Al enviar/programar, Inngest trocea la audiencia, excluye supresiones y contactos no
   aptos, personaliza cada email y llama al servicio Resend por lotes.
7. Resend entrega los correos y llama a `/api/webhooks/resend` con eventos de envío,
   entrega, apertura, clic, rebote, queja, supresión, fallo y retraso.
8. Nexo CRM guarda esos eventos en `email_events`, actualiza `campaign_recipients`, añade
   supresiones cuando toca y recalcula métricas.

### Qué necesita configurar el usuario

- Cuenta de Resend.
- Dominio o subdominio de envío verificado, por ejemplo `mg.tudominio.com`.
- DNS bien configurado: SPF, DKIM, MX de rebotes y DMARC.
- `RESEND_API_KEY`.
- `CAMPAIGN_FROM_EMAIL` y `CAMPAIGN_FROM_NAME`.
- Datos legales/RGPD: nombre legal, dirección, email de contacto, política de privacidad,
  base legal y explicación de origen/consentimiento.
- Webhook público de Resend apuntando a `/api/webhooks/resend`.
- `RESEND_WEBHOOK_SECRET`.
- En producción, `NEXT_PUBLIC_APP_URL` correcto para enlaces públicos, tracking y bajas.

### Regla de producto

Si falta Resend, la app debe degradar con claridad: se puede preparar una campaña, pero no
enviarla. Si falta RGPD, dominio, remitente o webhook, la UI debe enseñar qué falta antes
de permitir volumen real.

---

## 2. Pantalla global de redacción

La fase transversal debe añadir una pantalla propia para redactar correos desde el CRM,
no solo botones dentro de fichas.

### Ruta y entrada

- Ruta propuesta: `/emails/compose`.
- Accesos: navegación, comando rápido, ficha de contacto, ficha de empresa, ficha de
  negocio, bandeja y, más adelante, acciones de secuencia/automatización.

### Comportamiento esperado

- Selector de destinatario con búsqueda de contacto.
- Si se abre desde contacto/empresa/negocio, debe venir pre-rellenado.
- Vínculo opcional a contacto, empresa, negocio e hilo.
- Asunto, editor Tiptap, plantillas, merge tags, preview por destinatario y firma.
- Borrador con IA opcional, siempre editable y nunca auto-enviado.
- Envío por Gmail 1:1 reutilizando `sendEmail`.
- Tracking, límites diarios y firma deben funcionar igual que en el compositor actual.
- Guardas visibles: sin Gmail conectado, sin `gmail.send`, límite diario agotado, contacto
  sin email o plantilla con variables desconocidas.

### No debe hacer

- No debe enviar campañas masivas por Gmail.
- No debe saltarse `marketing_status` ni `suppressions` cuando se use como parte de un
  flujo de volumen.
- No debe exponer tokens OAuth ni claves Resend en UI.

---

## 3. Plantilla de redacción base

Esta plantilla es el patrón inicial para sembrar plantillas comerciales y para orientar
la IA al redactar. Debe ser breve, concreta, revisable y compatible con merge tags.

### Plantilla: primer contacto consultivo

**Nombre:** Primer contacto consultivo  
**Canal recomendado:** Gmail 1:1 o primer paso de secuencia  
**Objetivo:** abrir conversación sin sonar a newsletter ni a automatización agresiva.

**Asunto**

```text
{{empresa|"Tu empresa"}} - idea rápida
```

**Cuerpo**

```text
Hola {{nombre|"buenas"}},

Te escribo porque he visto que {{empresa|"vuestra empresa"}} trabaja en un contexto donde ordenar contactos, seguimientos y oportunidades suele marcar bastante diferencia.

En Nexo estamos trabajando en un sistema para ordenar contactos, embudos, emails y seguimientos sin perder oportunidades por el camino. La idea no es mandarte una presentación larga, sino ver si hay un problema real que merezca una conversación.

¿Te encajaría una llamada breve esta semana o la que viene?

Un saludo,
```

### Variables esperadas

- `{{nombre|"buenas"}}`: nombre del contacto con fallback.
- `{{empresa|"Tu empresa"}}`: empresa vinculada con fallback.
- Campos de serie disponibles: `{{apellidos}}`, `{{nombre_completo}}`, `{{email}}`,
  `{{telefono}}`, `{{cargo}}`, `{{campaign}}`, `{{empresa.nombre_comercial}}`,
  `{{empresa.web}}`, `{{empresa.sector}}`.
- Campos personalizados: cualquier clave existente del contacto, o `empresa.<clave>` si
  pertenece a la empresa.

> Nota de implementación: normalizar los nombres de variables antes de sembrar plantillas.
> El motor actual ya soporta campos de serie, empresa, campos personalizados y fallback.

### Checklist de calidad antes de enviar

- El asunto cabe en móvil y no parece clickbait.
- El primer párrafo explica por qué se escribe a esa persona.
- El cuerpo tiene una sola idea principal.
- Hay una llamada a la acción concreta.
- No promete datos inventados por IA.
- Si es campaña o secuencia masiva, respeta bajas, supresiones y base legal.

---

## 4. Secuencias y automatizaciones

La siguiente mejora importante no es más IA, sino más acciones dentro de secuencias.

### Nuevo paso: Acción CRM

El constructor de secuencias debe poder añadir un paso que ejecute acciones internas:

- Mover etapa o embudo.
- Añadir o quitar etiqueta.
- Actualizar campo de contacto/empresa/negocio.
- Crear tarea.
- Inscribir en otra secuencia.
- Parar una secuencia.
- Notificar.
- Llamar a webhook.

### Caso clave pedido por el usuario

Cuando una secuencia avance por un paso concreto, debe poder mover el contacto/negocio a
otra etapa de otro embudo. Como el embudo actual reutiliza `deals`, la acción debe resolver
el `deal` vinculado al contacto. Si no existe, hay que tomar una decisión explícita de
producto:

- **Opción recomendada:** crear entrada de embudo en la primera etapa del embudo destino y
  moverla después a la etapa elegida.
- **Opción conservadora:** omitir la acción y registrar aviso en el historial de ejecución.

La recomendada encaja mejor con el uso real de prospección, pero debe quedar visible en el
dry-run para que el usuario no se lleve sorpresas.
