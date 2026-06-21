"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  type SegmentDefinition,
  type SegmentMatch,
  describeRule,
} from "@/lib/segments";
import type { SegmentAudience } from "@/server/queries/segments";
import type { SequenceEnrollmentSequenceOption } from "@/server/queries/sequences";
import { deleteSegment } from "@/server/actions/segments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type LabelOption,
  type SegmentInitial,
  SegmentFormDialog,
} from "@/components/segments/segment-form-dialog";
import { SequenceEnrollmentButton } from "@/components/sequences/sequence-enrollment-dialog";

export type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  kind: "dynamic" | "static";
  definition: SegmentDefinition;
  audience: SegmentAudience;
};

export function SegmentsView({
  segments,
  labels,
  sequenceOptions,
}: {
  segments: SegmentRow[];
  labels: LabelOption[];
  sequenceOptions: SequenceEnrollmentSequenceOption[];
}) {
  const [dialog, setDialog] = React.useState<SegmentInitial | "new" | null>(
    null,
  );

  const labelsById = React.useMemo(
    () => Object.fromEntries(labels.map((l) => [l.id, l.name])),
    [labels],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog("new")}>
          <Plus />
          Nuevo segmento
        </Button>
      </div>

      {segments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Target className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Aún no tienes segmentos</p>
              <p className="text-muted-foreground text-sm">
                Crea audiencias por filtros para tus campañas.
              </p>
            </div>
            <Button onClick={() => setDialog("new")}>
              <Plus />
              Nuevo segmento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {segments.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              labelsById={labelsById}
              sequenceOptions={sequenceOptions}
              onEdit={() =>
                setDialog({
                  id: segment.id,
                  name: segment.name,
                  description: segment.description,
                  match: segment.definition.match ?? "all",
                  rules: segment.definition.rules ?? [],
                })
              }
            />
          ))}
        </div>
      )}

      <SegmentFormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        segment={dialog === "new" ? null : dialog}
        labels={labels}
      />
    </div>
  );
}

function SegmentCard({
  segment,
  labelsById,
  sequenceOptions,
  onEdit,
}: {
  segment: SegmentRow;
  labelsById: Record<string, string>;
  sequenceOptions: SequenceEnrollmentSequenceOption[];
  onEdit: () => void;
}) {
  const router = useRouter();
  const rules = segment.definition.rules ?? [];
  const match: SegmentMatch = segment.definition.match ?? "all";
  const joiner = match === "any" ? " o " : " y ";

  async function remove() {
    try {
      await deleteSegment(segment.id);
      toast.success("Segmento eliminado");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar",
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{segment.name}</CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Acciones" />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={remove}>
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {segment.description ? (
          <p className="text-muted-foreground text-sm">{segment.description}</p>
        ) : null}

        <p className="text-sm">
          {rules.length === 0 ? (
            <span className="text-muted-foreground">Todos los contactos</span>
          ) : (
            rules.map((rule, i) => (
              <span key={i}>
                {i > 0 ? (
                  <span className="text-muted-foreground">{joiner}</span>
                ) : null}
                <span>{describeRule(rule, labelsById)}</span>
              </span>
            ))
          )}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {segment.audience.reachable} alcanzables
            </Badge>
            <span className="text-muted-foreground text-xs">
              {segment.audience.withEmail} con email · {segment.audience.total}{" "}
              contactos
            </span>
          </div>
          <SequenceEnrollmentButton
            label="Inscribir"
            sequenceOptions={sequenceOptions}
            personOptions={[]}
            segmentOptions={[]}
            lockedSegment={{ id: segment.id, name: segment.name }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
