# 06 · Campos personalizados, importación y personalización de email

Este documento recoge un requisito clave del proyecto: poder **definir campos
propios** en contactos y empresas, **importarlos desde Excel/CSV** mapeando columnas,
y **usarlos como variables en las secuencias y campañas** para que cada correo se
personalice por destinatario.

## 1. Campos de serie (built-in)

**Contacto (persona):** nombre, apellidos, email, teléfono, cargo, empresa, origen,
estado de marketing.

**Empresa:** nombre **legal** (`name`), **nombre comercial** (`trade_name`) ← nuevo
campo de serie, dominio, web, teléfono, dirección, sector, tamaño.

> El nombre comercial va de serie porque es muy común usarlo en los correos en lugar
> del nombre legal.

## 2. Campos personalizados (definidos por el usuario)

El usuario puede **crear sus propios campos** ("columnas especiales") en Ajustes →
Campos personalizados, sin tocar código. Cada campo tiene:

- **Nombre** visible (p. ej. "Ingresos", "EBITDA", "Web", "Sector NACE").
- **Clave** técnica autogenerada para las variables (p. ej. `ingresos`, `ebitda`).
- **Tipo:** texto · número · **monetario** (ingresos) · fecha · sí/no · selección ·
  selección múltiple · URL.
- **Entidad:** contacto o empresa.

Los **valores** se guardan en el campo `custom_fields` (JSONB) de cada contacto/
empresa, así que añadir un campo nuevo **no requiere migración** de base de datos.

Estos campos aparecen como **columnas opcionales** en los listados, como campos en
las fichas y formularios, y como **filtros**.

## 3. Importación desde Excel / CSV (con mapeo de columnas)

Al subir un archivo **.xlsx (Excel)** o **.csv**:

1. Se leen las **columnas** del archivo (primera fila = cabeceras).
2. Se muestra una pantalla de **mapeo**: para cada columna del archivo eliges a qué
   campo del CRM corresponde (nombre, email, empresa…, o un **campo personalizado**).
3. Si una columna no existe como campo, puedes **crear el campo personalizado al
   vuelo** desde el propio mapeo.
4. **Vista previa** de las primeras filas + **deduplicación** por email.
5. Importación (en lotes vía Inngest si el archivo es grande).

> Soportamos Excel (.xlsx) además de CSV. Excel se procesa con un lector de hojas de
> cálculo; CSV con papaparse.

## 4. Personalización en secuencias y campañas (merge tags)

En el redactor de correos (secuencias y campañas) puedes insertar **variables** que
se sustituyen por el valor de cada destinatario. Sintaxis:

```
Hola {{nombre}},

Vi que en {{empresa.nombre_comercial}} habéis facturado {{ingresos}} este año…
```

- Variables disponibles: **todos los campos de serie + todos los campos
  personalizados** del contacto y de su empresa.
- **Valor por defecto / fallback** si el contacto no tiene ese dato:
  `{{nombre|"amigo"}}` → usa "amigo" si no hay nombre. Evita correos con huecos vacíos.
- **Vista previa por destinatario** antes de enviar (ver cómo queda con datos reales).
- **Aviso de campos faltantes**: si muchos destinatarios no tienen un campo usado,
  se avisa antes de enviar.

Así, una misma secuencia/campaña enviada a **muchos contactos** sale **personalizada
para cada uno** (nombre comercial, ingresos, o cualquier campo inventado por ti).

## 5. Dónde encaja en el roadmap

- **Fase 1 · 1.8** — Motor de campos personalizados (crear/editar campos, render en
  fichas/formularios/listados, filtros). + `trade_name` de serie en empresas.
- **Fase 1 · 1.13** — Importación **Excel/CSV** con mapeo de columnas y creación de
  campos al vuelo.
- **Fase 3 · 3.6** — Redactor con **merge tags** (campos de serie + personalizados),
  fallback y vista previa por destinatario.
- **Fase 4 (campañas)** y **Fase 5 (secuencias)** — usan ese mismo motor de merge
  tags para personalizar cada envío.

> Resumen: el plan ya contempla campos personalizados e importación; este documento
> los precisa y añade explícitamente el **nombre comercial de serie**, el **soporte
> de Excel** y la **personalización por destinatario en los correos**.
