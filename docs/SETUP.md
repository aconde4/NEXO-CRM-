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

---

## Cuando termines

Dime **“ya tengo Supabase y Google”** y haré:
- `pnpm db:push` para crear las tablas.
- Conectar Auth.js (login con Google, allowlist, protección de rutas).
- Probar el login en local.
- Y cuando quieras, el despliegue en Vercel.
