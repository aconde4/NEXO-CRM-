import type { CrmActionConfig, CrmActionKind } from "@/lib/validations/sequence";

/** Etiquetas legibles de cada acción CRM (Fase T.3), compartidas por server y UI. */
export const CRM_ACTION_LABELS: Record<CrmActionKind, string> = {
  add_label: "Añadir etiqueta",
  create_task: "Crear tarea",
  enroll_sequence: "Inscribir en otra secuencia",
  move_stage: "Mover de etapa / embudo",
  notify: "Notificar",
  remove_label: "Quitar etiqueta",
  stop_sequence: "Parar otra secuencia",
  update_field: "Actualizar campo",
  webhook: "Llamar a webhook",
};

/** Orden de presentación en el selector del builder. */
export const CRM_ACTION_KINDS: CrmActionKind[] = [
  "move_stage",
  "add_label",
  "remove_label",
  "update_field",
  "create_task",
  "enroll_sequence",
  "stop_sequence",
  "notify",
  "webhook",
];

/** Config por defecto al crear el paso o al cambiar de tipo de acción. */
export function defaultCrmAction(
  kind: CrmActionKind = "notify",
): CrmActionConfig {
  switch (kind) {
    case "move_stage":
      return { createIfMissing: true, kind, pipelineId: "", stageId: "" };
    case "add_label":
    case "remove_label":
      return { kind, labelId: "" };
    case "update_field":
      return { field: "", kind, scope: "person", value: "" };
    case "create_task":
      return { kind, taskNotes: "", taskSubject: "Revisar contacto" };
    case "enroll_sequence":
    case "stop_sequence":
      return { kind, sequenceId: "" };
    case "webhook":
      return { kind, url: "" };
    case "notify":
    default:
      return { kind: "notify", message: "Revisar este contacto" };
  }
}
