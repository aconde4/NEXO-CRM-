# 00 · Visión y Plan Maestro

> **Este es el documento raíz.** Explica qué construimos, las reglas del proyecto y
> —lo más importante para ti— **cómo retomar el trabajo exactamente donde lo
> dejaste** si te quedas sin créditos. Léelo entero una vez.

---

## 1. Visión

Un **CRM personal, autoalojado y propiedad tuya**, inspirado en Pipedrive pero
superior en tres ejes:

1. **Email serio de verdad:** secuencias 1:1 que parecen escritas a mano (desde tu
   Gmail) **y** campañas masivas con plantillas, segmentación, bajas y métricas. En
   Pipedrive esto son *add-ons de pago separados y limitados*; aquí va todo unido.
2. **Automatizaciones de nivel superior:** un motor visual tipo "canvas" con
   disparadores, condiciones, esperas y ramificaciones, construido sobre un
   ejecutor de workflows duraderos (Inngest). Más potente que la lista lineal de
   Pipedrive.
3. **IA integrada (Claude) en todo:** redactar correos, resumir el historial de un
   contacto, crear secuencias/automatizaciones a partir de una frase, puntuar
   leads, sugerir la siguiente acción y analizar el sentimiento de las respuestas.

Coste objetivo: **~0 €/mes al inicio** (planes gratuitos), frente a los add-ons
apilados de Pipedrive (Campaigns + LeadBooster + Smart Docs + Web Visitors se van
fácil a 100+ €/mes).

## 2. Decisiones de producto (cerradas el 16/06/2026)

| Decisión | Elección | Implicación |
|---|---|---|
| Modo de trabajo | Mixto con apoyo | Claude escribe el código y explica lo esencial de cada parte. |
| Estrategia de email | Ambas por igual | Arquitectura de email doble: Gmail API (1:1) + Resend (masivo). |
| Hosting | En la nube | Vercel + Supabase + Inngest. Las automatizaciones corren 24/7. |
| Primer MVP | Contactos + Pipeline | Fases 1 y 2 son la prioridad tras las fundaciones. |
| Región / legal | UE (España) | RGPD desde el día uno: consentimiento, bajas, supresión, export. |

## 3. Principios de construcción

1. **Cada fase termina desplegada y usable.** Nunca dejamos la app rota entre
   fases. Al cerrar una fase, está en producción y aporta valor por sí sola.
2. **Vertical slices, no capas sueltas.** Construimos funcionalidades completas
   (datos → API → UI) en vez de "primero toda la base de datos, luego toda la UI".
3. **Commits pequeños y frecuentes.** Cada tarea con checkbox ≈ 1 commit. Así, si
   se corta, se pierde como mucho una tarea.
4. **El estado vive en disco, no en la memoria de Claude.** La fuente de verdad de
   "dónde estamos" es [`ESTADO-ACTUAL.md`](ESTADO-ACTUAL.md), no la conversación.
5. **Seguridad y RGPD transversales,** no una fase al final.

## 4. 🔴 PROTOCOLO DE REANUDACIÓN (léelo si vuelves tras quedarte sin créditos)

Esto resuelve tu preocupación: **cómo seguir construyendo justo por donde ibas.**

### Si eres tú (el usuario) volviendo en una sesión nueva
Pega esto a Claude:

> «Retomamos el CRM. Lee `docs/ESTADO-ACTUAL.md` y `docs/04-ROADMAP-DETALLADO.md`,
> dime en qué fase y tarea estamos y continúa por la siguiente tarea sin terminar.»

### Si eres Claude empezando una sesión sobre este proyecto
Haz **siempre** esto antes de tocar nada:

1. **Lee** [`docs/ESTADO-ACTUAL.md`](ESTADO-ACTUAL.md) → te dice fase actual, última
   tarea completada y la siguiente tarea exacta.
2. **Lee** la sección de la fase activa en
   [`docs/04-ROADMAP-DETALLADO.md`](04-ROADMAP-DETALLADO.md).
3. **Verifica el estado real del código** (no te fíes solo del documento):
   - `git log --oneline -15` para ver los últimos commits.
   - `git status` para ver trabajo a medias.
   - Arranca la app (`pnpm dev`) si hay que comprobar algo.
4. **Continúa** por la primera tarea con `[ ]` sin marcar de la fase activa.
5. **Al terminar cada tarea:** marca su checkbox en el roadmap, haz commit, y
   **actualiza `docs/ESTADO-ACTUAL.md`** (sección "Siguiente paso" y el changelog).
6. **Al cerrar una sesión** (o cuando se intuya poco crédito): deja
   `ESTADO-ACTUAL.md` actualizado y un commit limpio. Nunca dejes la app sin
   compilar.

> **Regla de oro:** un observador externo debe poder leer `ESTADO-ACTUAL.md` y
> `git log` y saber en 30 segundos qué hacer a continuación. Si no es así, el
> estado está mal escrito.

## 5. Índice de fases (resumen)

> Detalle completo con checklists en [`04-ROADMAP-DETALLADO.md`](04-ROADMAP-DETALLADO.md).

| Fase | Nombre | Resultado al cerrarla |
|---|---|---|
| **0** | Fundaciones | App desplegada en Vercel, login con Google, esqueleto de UI, BD conectada, Inngest vivo. |
| **1** | Contactos y Empresas | Importar/gestionar contactos y empresas, campos personalizados, actividades. |
| **2** | Pipeline / Embudos / Negocios | Embudo Kanban con arrastrar y soltar, varios pipelines, previsión. **← Fin del MVP prioritario.** |
| **3** | Email 1:1 (Gmail) | Enviar/recibir correos desde un contacto, plantillas, seguimiento de aperturas/clics, bandeja unificada. |
| **4** | Campañas masivas (Resend) | Enviar campañas a un segmento, dominio verificado, bajas, RGPD y métricas. |
| **5** | Secuencias / Drip | Inscribir contactos en secuencias multi-paso con esperas y parada al responder. |
| **6** | Motor de automatizaciones | Constructor visual: disparadores, condiciones, esperas y acciones. |
| **7** | Captación (formularios web) | Formularios embebibles, bandeja de leads y conversión a negocio. |
| **8** | IA integrada (Claude) | Redacción de correos, resúmenes, secuencias por lenguaje natural, lead scoring. |
| **9** | Analítica y reporting | Paneles de conversión, previsión, actividad y rendimiento de email. |
| **10** | Extras y pulido | Documentos/firma, productos y presupuestos, PWA móvil, canales extra (WhatsApp/SMS). |

## 6. Qué NO vamos a hacer (al inicio, para no dispersarnos)

- Multiusuario / equipos / permisos por rol (lo dejamos preparado en datos, pero la
  app es monousuario al principio).
- App móvil nativa (la web será responsive/PWA).
- Telefonía VoIP integrada.
- Marketplace de integraciones (haremos integraciones puntuales vía webhooks).

## 7. Cómo medir que vamos bien

Cada fase tiene **criterios de aceptación** explícitos en el roadmap. Una fase no se
considera "cerrada" hasta que: (a) sus criterios pasan, (b) está desplegada en
producción, (c) `ESTADO-ACTUAL.md` está actualizado, (d) no hay errores de TypeScript
ni de build.

---

➡️ Siguiente lectura: [`01-ARQUITECTURA-Y-STACK.md`](01-ARQUITECTURA-Y-STACK.md)
