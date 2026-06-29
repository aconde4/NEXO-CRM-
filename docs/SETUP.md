# SETUP · Cuentas y credenciales (lo que tienes que hacer tú)

Yo (Claude) ya he dejado todo el código listo. Faltan unas cuentas externas que
solo puedes crear tú. Sigue estos pasos y pega los valores en `.env.local`. Cuando
termines, dímelo y conecto la base de datos, el login y el despliegue.

> Todo tiene plan gratuito. Tiempo estimado: ~20-30 min.

---

## 1. Supabase (base de datos) — necesario

1. Entra en https://supabase.com → **New project**. Elige una contraseña de BD
   (apúntala) y una región europea (p. ej. *Central EU (Frankfurt)*).
2. Cuando esté listo, pulsa el botón **Connect** (arriba del todo) → pestaña
   **App Frameworks** o **ORMs** (también vale **Database → Connection**).
3. Copia DOS cadenas y pégalas en `.env.local`:
   - **`DATABASE_URL`** → **Transaction pooler** (puerto **6543**). Añade
     `?pgbouncer=true` al final si no lo trae. (La usa la app en producción.)
   - **`DIRECT_URL`** → **Session pooler** (puerto **5432**). (La usan las
     migraciones; el Session pooler funciona por IPv4, evita errores de conexión.)
4. Sustituye `[YOUR-PASSWORD]` por la contraseña que pusiste en el paso 1.

## 2. Google OAuth (inicio de sesión + futuro Gmail) — necesario

1. Entra en https://console.cloud.google.com → crea un proyecto (p. ej. "Nexo CRM").
2. **APIs y servicios → Pantalla de consentimiento OAuth** → tipo **Externo** →
   rellena lo básico → añade tu correo como **usuario de prueba**.
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
   → tipo **Aplicación web**.
4. En **URIs de redirección autorizados** añade:
   - `http://localhost:3000/api/auth/callback/google`
   - (más adelante, la de producción: `https://TU-APP.vercel.app/api/auth/callback/google`)
5. Copia **Client ID** y **Client secret** → `GOOGLE_CLIENT_ID` y
   `GOOGLE_CLIENT_SECRET` en `.env.local`.
6. **APIs y servicios → Biblioteca** → busca **Gmail API** → **Habilitar**.
7. En la pantalla de consentimiento, revisa que la app pueda pedir estos permisos:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
8. Reinicia `pnpm dev`, entra en `/inbox` y pulsa **Conectar Gmail** o
   **Reautorizar Gmail** para conceder los nuevos permisos.

> `AUTH_SECRET` ya está generado en tu `.env.local`. `ALLOWED_EMAILS` ya tiene tu
> correo (solo tú podrás entrar).
>
> Nota de producción: Google clasifica `gmail.send` como permiso sensible y
> `gmail.readonly` como restringido. En local/desarrollo basta con usuarios de
> prueba; si la app se publica para más usuarios, puede requerir verificación OAuth
> y revisión de seguridad de Google.

## 2 bis. Usar tu correo de empresa (@miempresa.com)

Sí se puede, y suele ser lo ideal. Depende de quién aloje ese correo:

- **Si es Google Workspace** (Gmail de empresa con @miempresa.com): funciona
  exactamente igual que con Gmail. Inicias sesión con esa cuenta y las **secuencias
  1:1** salen desde tu buzón de empresa (máxima entregabilidad). Solo añade tu
  correo de empresa a `ALLOWED_EMAILS`.
- **Si es Microsoft 365 / Outlook:** se conecta con Microsoft Graph (equivalente a
  la Gmail API). Lo añadimos como integración aparte cuando lleguemos a la Fase 3.
- **Otro proveedor (IMAP/SMTP genérico, cPanel…):** se conecta por SMTP (envío) +
  IMAP (lectura). También se puede; requiere host/usuario/contraseña del correo.
- **Campañas masivas** desde @miempresa.com: independientemente del correo, se
  hacen con **Resend verificando tu dominio** (registros SPF/DKIM/DMARC en el DNS).
  Así envías "desde" tu dominio con buena entregabilidad. (Fase 4.)

> Para decidir bien, dime **quién aloja el correo de tu empresa** (Google Workspace,
> Microsoft 365 u otro). No bloquea nada ahora: el login inicial puede ser tu Gmail
> y luego conectamos el de empresa.

## 2 ter. Supabase Storage (adjuntos de archivos, Fase 1.12) — opcional

Los adjuntos en las fichas usan **Supabase Storage**. Sin esto, la app funciona
igual pero el panel "Archivos" aparece desactivado. Para activarlo:

1. En el panel de Supabase → **Storage** → **New bucket**: nombre **`attachments`**,
   marcado como **privado** (sin acceso público). Los archivos se sirven con enlaces
   firmados temporales.
2. **Settings → API → Project API keys** → copia la clave **`service_role`**
   (¡secreta, solo backend!) y pégala en `.env.local`:
   `SUPABASE_SERVICE_ROLE_KEY="..."`.
   - `SUPABASE_URL` se deduce de `DATABASE_URL`; solo defínela si quieres forzarla.
   - El bucket por defecto es `attachments` (cambiable con `SUPABASE_STORAGE_BUCKET`).
3. Reinicia `pnpm dev`. El panel "Archivos" quedará activo (subir/descargar/borrar,
   máx. 10 MB por archivo).

> En producción (Vercel) añade `SUPABASE_SERVICE_ROLE_KEY` como variable de entorno.

## 3. GitHub (repositorio) — recomendado

1. Crea un repositorio **privado** vacío en https://github.com/new (p. ej. `nexo-crm`).
2. Pásame la URL y conecto el repo local (`git remote add` + `push`). El primer
   commit ya está hecho en local.

## 4. Vercel (hosting) — cuando despleguemos (tarea 0.15)

1. Entra en https://vercel.com con tu GitHub e **importa** el repositorio.
2. En **Environment Variables** pega las mismas variables del `.env.local`
   (con la URL de producción en `NEXT_PUBLIC_APP_URL`).
3. Deploy. A partir de ahí, cada `git push` despliega solo.

## 4 bis. Tracking de aperturas/clics — importante desde la Fase 3.7

El tracking de emails usa URLs públicas de tu CRM:

- Aperturas: un pixel propio en `/api/email/track/open/...`.
- Clics: una redirección firmada en `/api/email/track/click/...`.

En local, si envías un correo real con `http://localhost:3000`, Gmail no puede cargar
ese pixel desde internet. Para medir aperturas/clics de destinatarios reales necesitas
desplegar la app y definir en Vercel:

```env
NEXT_PUBLIC_APP_URL=https://TU-APP.vercel.app
AUTH_SECRET=el_mismo_secret_seguro_que_uses_en_produccion
```

Si más adelante cambias a un dominio propio, actualiza `NEXT_PUBLIC_APP_URL` y
redeploy. Los enlaces ya enviados seguirán apuntando al dominio antiguo.

## 5. Inngest (automatizaciones) — cuando despleguemos

1. Entra en https://www.inngest.com con tu GitHub.
2. Copia **Event Key** y **Signing Key** → variables en Vercel.
   (En local no hace falta nada: se usa el Dev Server de Inngest.)

## 6. Resend (campañas masivas, Fase 4) — necesario para campañas

Las campañas masivas se envían con **Resend** verificando tu dominio (no por Gmail).
Sin `RESEND_API_KEY` la app degrada con elegancia: el módulo de campañas avisa de que
Resend no está configurado y no intenta ningún envío.

1. Crea una cuenta en https://resend.com (plan gratuito: 3.000 emails/mes, 100/día).
2. **API Keys → Create API Key** (permiso de envío). Cópiala a `.env.local`:
   ```env
   RESEND_API_KEY="re_..."
   ```
3. **Domains → Add Domain** con tu dominio de envío (raíz `tudominio.com` o un
   subdominio como `mg.tudominio.com`). Resend te dará varios registros DNS:
   - **MX** (para el subdominio de rebotes/bounce) y **SPF** (`TXT` con
     `v=spf1 include:amazonses.com ~all` o el que indique Resend).
   - **DKIM** (`TXT`/`CNAME` con la clave pública; firma tus correos).
   - **DMARC** (recomendado): `TXT` en `_dmarc.tudominio.com` con
     `v=DMARC1; p=none; rua=mailto:tu@correo`.
4. Añade esos registros en el DNS de tu dominio (Cloudflare, Namecheap, IONOS…) y pulsa
   **Verify** en Resend hasta que el dominio quede **Verified** (suele tardar minutos).
5. Define el remitente por defecto de campañas en `.env.local` (debe ser de ese
   dominio verificado):
   ```env
   CAMPAIGN_FROM_EMAIL="campañas@tudominio.com"
   CAMPAIGN_FROM_NAME="Tu Nombre o Empresa"
   ```
6. Define los datos legales que aparecerán por defecto en el pie RGPD de las campañas
   (también puedes ajustarlos campaña a campaña desde el editor):
   ```env
   CAMPAIGN_LEGAL_NAME="Tu Empresa, S.L."
   CAMPAIGN_LEGAL_ADDRESS="Calle Ejemplo 1, 28000 Madrid, España"
   CAMPAIGN_CONTACT_EMAIL="privacidad@tudominio.com"
   CAMPAIGN_PRIVACY_URL="https://tudominio.com/privacidad"
   CAMPAIGN_CONSENT_BASIS="consent" # o "legitimate_interest"
   CAMPAIGN_CONSENT_NOTICE="te registraste, solicitaste información o eres contacto profesional de la empresa"
   ```
7. **Webhooks → Add Webhook**. Usa esta URL pública:
   ```text
   https://TU-APP.vercel.app/api/webhooks/resend
   ```
   Selecciona estos eventos: `email.sent`, `email.delivered`, `email.opened`,
   `email.clicked`, `email.bounced`, `email.complained`, `email.suppressed`,
   `email.failed` y `email.delivery_delayed`.
8. Copia el **Signing Secret** del webhook (empieza por `whsec_`) y añádelo a
   `.env.local`:
   ```env
   RESEND_WEBHOOK_SECRET="whsec_..."
   ```

> En producción (Vercel) añade `RESEND_API_KEY`, `CAMPAIGN_FROM_EMAIL` y
> `CAMPAIGN_FROM_NAME` como variables de entorno. Añade también las variables
> `CAMPAIGN_LEGAL_*`, `CAMPAIGN_CONTACT_EMAIL`, `CAMPAIGN_PRIVACY_URL`,
> `CAMPAIGN_CONSENT_BASIS`, `CAMPAIGN_CONSENT_NOTICE` y `RESEND_WEBHOOK_SECRET` para
> que Nexo CRM pueda validar y registrar entregas, aperturas, clics, rebotes y quejas.
> En local necesitas exponer `pnpm dev` con un túnel público si quieres probar
> webhooks reales desde Resend.

## 6 bis. Auditoría antes de enviar volumen real

En `/campaigns` verás dos bloques de preparación: el checklist de Resend y la auditoría
transversal de entregabilidad/cumplimiento. Antes de enviar a una audiencia real, deja sin
bloqueos estos puntos:

- **Gmail 1:1:** Gmail conectado desde `/inbox`, permisos `gmail.send` y
  `gmail.readonly`, refresh token guardado y límite diario conservador en Ajustes →
  Correo.
- **Resend masivo:** `RESEND_API_KEY`, `CAMPAIGN_FROM_EMAIL`, `CAMPAIGN_FROM_NAME`,
  dominio verificado en Resend y registros SPF/DKIM/MX/DMARC publicados en DNS.
- **Webhooks y URL pública:** `RESEND_WEBHOOK_SECRET` configurado, webhook apuntando a
  `/api/webhooks/resend` y `NEXT_PUBLIC_APP_URL` con la URL real de producción.
- **RGPD:** `CAMPAIGN_LEGAL_NAME`, `CAMPAIGN_LEGAL_ADDRESS`, `CAMPAIGN_CONTACT_EMAIL`,
  `CAMPAIGN_PRIVACY_URL`, `CAMPAIGN_CONSENT_BASIS` y `CAMPAIGN_CONSENT_NOTICE`
  completos.
- **Bajas y supresiones:** comprueba que las campañas incluyen baja visible y que las
  supresiones por baja, rebote, queja o Resend quedan registradas antes del siguiente
  envío.

Calentamiento recomendado para un dominio nuevo o poco usado:

| Periodo | Volumen diario orientativo | Qué mirar |
| --- | ---: | --- |
| Días 1-3 | 20-50 emails/día | Rebotes, quejas y respuestas reales |
| Días 4-7 | 50-100 emails/día | Mantener rebotes bajos y segmentación limpia |
| Semana 2 | 100-250 emails/día | Subir solo si no hay señales negativas |
| Semana 3+ | Subida gradual | Ajustar por reputación, dominio y calidad de audiencia |

Si hay rebotes o quejas, pausa la campaña, limpia emails inválidos/no consentidos y revisa
el origen del segmento antes de reintentar.

---

## 7. IA (Fase 8) — opcional al principio

Sin estas variables, Nexo CRM no rompe: el panel **Ajustes → IA** mostrará la capa como
sin configurar y las futuras funciones de IA quedarán desactivadas.

Para empezar gratis con un proveedor OpenAI-compatible:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY="tu_api_key"
AI_MODEL=llama-3.3-70b-versatile
AI_MODEL_FAST=llama-3.1-8b-instant
```

Para Ollama local:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=qwen2.5:14b
AI_MODEL_FAST=qwen2.5:7b
```

Opcionalmente, para estimar coste en `ai_runs`:

```env
AI_INPUT_COST_PER_1M=0
AI_OUTPUT_COST_PER_1M=0
AI_TIMEOUT_MS=30000
AI_RETRIES=1
```

Los adaptadores `gemini` y `anthropic` se añadirán cuando elijas proveedor concreto; la
base actual ya permite probar gratis con Groq, OpenRouter, Together, Ollama/LM Studio y
otros endpoints OpenAI-compatible.

---

## Cuando termines

Dime **“ya tengo Supabase y Google”** y haré:
- `pnpm db:push` para crear las tablas.
- Conectar Auth.js (login con Google, allowlist, protección de rutas).
- Probar el login en local.
- Y cuando quieras, el despliegue en Vercel.
