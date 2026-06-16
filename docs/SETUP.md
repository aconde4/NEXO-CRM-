# SETUP · Cuentas y credenciales (lo que tienes que hacer tú)

Yo (Claude) ya he dejado todo el código listo. Faltan unas cuentas externas que
solo puedes crear tú. Sigue estos pasos y pega los valores en `.env.local`. Cuando
termines, dímelo y conecto la base de datos, el login y el despliegue.

> Todo tiene plan gratuito. Tiempo estimado: ~20-30 min.

---

## 1. Supabase (base de datos) — necesario

1. Entra en https://supabase.com → **New project**. Elige una contraseña de BD y
   una región europea (p. ej. *West EU (Ireland)*).
2. Cuando esté listo: **Project Settings → Database → Connection string**.
3. Copia DOS cadenas y pégalas en `.env.local`:
   - **`DATABASE_URL`** → la del **pooler** (modo *Transaction*, puerto **6543**).
     Añade `?pgbouncer=true` al final si no lo trae.
   - **`DIRECT_URL`** → la **directa** (puerto **5432**).
4. Sustituye `[YOUR-PASSWORD]` por la contraseña que pusiste.

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

> `AUTH_SECRET` ya está generado en tu `.env.local`. `ALLOWED_EMAILS` ya tiene tu
> correo (solo tú podrás entrar).

## 3. GitHub (repositorio) — recomendado

1. Crea un repositorio **privado** vacío en https://github.com/new (p. ej. `nexo-crm`).
2. Pásame la URL y conecto el repo local (`git remote add` + `push`). El primer
   commit ya está hecho en local.

## 4. Vercel (hosting) — cuando despleguemos (tarea 0.15)

1. Entra en https://vercel.com con tu GitHub e **importa** el repositorio.
2. En **Environment Variables** pega las mismas variables del `.env.local`
   (con la URL de producción en `NEXT_PUBLIC_APP_URL`).
3. Deploy. A partir de ahí, cada `git push` despliega solo.

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
