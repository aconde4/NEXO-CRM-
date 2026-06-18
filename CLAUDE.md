@AGENTS.md

# Notas específicas de Claude Code

La guía del proyecto (protocolo de reanudación, stack, comandos, convenciones, gates de
calidad, migraciones y cómo verificar) está en **`AGENTS.md`** y aplica a todos los
asistentes. Aquí solo va lo específico de Claude.

## Vista previa (MCP de Claude Preview)

- Config en `.claude/launch.json` (servidor `nexo-crm`, `pnpm dev`, puerto 3000).
- Las **lecturas** del DOM con `preview_eval` funcionan; pero `preview_screenshot`
  falla por el websocket de HMR en dev, y las **superposiciones de Base UI** (popover,
  dropdown, command/⌘K, dialog) **no se abren con clics sintéticos** del navegador
  headless. El **arrastrar y soltar** (dnd-kit) tampoco se puede simular.
  → Verifica leyendo el DOM, con `fetch`, o a nivel de BD con un script `tsx`; no con
  capturas ni clics en overlays. Para drag, comprueba el render y la lógica de servidor.
- Tras `pnpm build` con `next dev` activo se corrompe `.next` (lo comparten): reinicia
  el dev server (o borra `.next`) si la vista previa se cuelga.

## Memoria

Hay notas en la memoria de Claude (`~/.claude/.../memory/`) que **Codex no lee**; lo
esencial para el relevo (identidad de git, gotchas, gates) está replicado en
`AGENTS.md`, que sí leen ambos.
