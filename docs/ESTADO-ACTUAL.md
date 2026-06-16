# ESTADO ACTUAL · (archivo vivo)

> **Este es el primer archivo que se lee al retomar el proyecto.** Indica exactamente
> dónde estamos y qué hacer a continuación. Se actualiza al final de cada sesión y
> al terminar cada tarea.

---

## 📍 Dónde estamos

- **Fase activa:** FASE 0 · Fundaciones — **aún no iniciada** (solo planificación hecha).
- **Última tarea completada:** ninguna (código de la app sin empezar).
- **Estado del repo:** sin inicializar git todavía; solo existen los documentos de
  `docs/` y el `README.md`.

## ⏭️ Siguiente paso concreto

**Empezar la tarea 0.1 del roadmap:** instalar Node LTS con
`pnpm env use --global lts` y verificar `node -v`. Después seguir con 0.2 (crear el
proyecto Next.js). Ver detalle en
[`04-ROADMAP-DETALLADO.md`](04-ROADMAP-DETALLADO.md) → FASE 0.

## 🔁 Cómo retomar (resumen)

1. Lee este archivo y la FASE activa en `04-ROADMAP-DETALLADO.md`.
2. Verifica el estado real: `git log --oneline -15` y `git status`.
3. Continúa por la primera tarea `[ ]` sin marcar.
4. Al terminar: marca el checkbox, commit, y actualiza este archivo.

(Protocolo completo en [`00-VISION-Y-PLAN-MAESTRO.md`](00-VISION-Y-PLAN-MAESTRO.md) §4.)

## ✅ Prerrequisitos del entorno (verificar antes de la Fase 0)

- [x] `pnpm` instalado (v10.33).
- [x] `git` instalado (v2.54).
- [ ] Node.js instalado (pendiente — tarea 0.1).
- [ ] Cuenta GitHub lista.
- [ ] Cuenta Vercel lista.
- [ ] Proyecto Supabase creado.
- [ ] Credenciales OAuth de Google creadas.
- [ ] Cuenta Inngest lista.

## 🚧 Decisiones pendientes / dudas abiertas

- (ninguna por ahora — las 4 decisiones de producto están cerradas, ver
  `00-VISION-Y-PLAN-MAESTRO.md` §2.)

---

## 🗒️ Changelog por sesión

### 2026-06-16 — Planificación inicial
- Investigadas las funcionalidades de Pipedrive (incl. add-ons) y definidas mejoras.
- Comprobado que no hay conectores/MCP en el registro para email/BD: se resuelve con
  librerías en el código.
- Cerradas las 4 decisiones de producto (modo de trabajo, email doble, nube, MVP).
- Creada toda la documentación del plan en `docs/` + `README.md`.
- **Pendiente:** empezar Fase 0 (tarea 0.1).
