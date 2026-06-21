"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  enrollInSequence,
  type SequenceEnrollmentResult,
} from "@/server/actions/sequences";
import type {
  SequenceEnrollmentPersonOption,
  SequenceEnrollmentSequenceOption,
} from "@/server/queries/sequences";
import type { SegmentListItem } from "@/server/queries/segments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type LockedPerson = {
  email: string | null;
  id: string;
  name: string;
};

type LockedSegment = {
  id: string;
  name: string;
};

type SequenceEnrollmentDialogProps = {
  defaultSequenceId?: string | null;
  lockedPerson?: LockedPerson | null;
  lockedSegment?: LockedSegment | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  personOptions: SequenceEnrollmentPersonOption[];
  segmentOptions: Pick<SegmentListItem, "id" | "name">[];
  sequenceOptions: SequenceEnrollmentSequenceOption[];
};

type SequenceEnrollmentButtonProps = Omit<
  SequenceEnrollmentDialogProps,
  "onOpenChange" | "open"
> & {
  label?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

const marketingLabels: Record<string, string> = {
  bounced: "Rebotado",
  complained: "Queja",
  subscribed: "Suscrito",
  unsubscribed: "Baja",
};

function firstEnrollSequence(
  options: SequenceEnrollmentSequenceOption[],
  defaultSequenceId?: string | null,
) {
  const active = options.filter((option) => option.canEnroll);
  return (
    active.find((option) => option.id === defaultSequenceId)?.id ??
    active[0]?.id ??
    ""
  );
}

function resultItems(result: SequenceEnrollmentResult) {
  return [
    ["Solicitados", result.requested],
    ["Inscritos", result.enrolled],
    ["Encolados", result.queued],
    ["Ya estaban", result.alreadyEnrolled],
    ["Sin email", result.skippedNoEmail],
    ["No suscritos", result.skippedNotSubscribed],
    ["Suprimidos", result.skippedSuppressed],
    ["No encontrados", result.skippedMissing],
  ] as const;
}

function resultMessage(result: SequenceEnrollmentResult) {
  if (result.enrolled > 0) {
    return `${result.enrolled} contacto${result.enrolled === 1 ? "" : "s"} inscrito${result.enrolled === 1 ? "" : "s"}.`;
  }
  if (result.alreadyEnrolled > 0) return "No había contactos nuevos.";
  return "No se encontró ningún contacto inscribible.";
}

export function SequenceEnrollmentButton({
  defaultSequenceId,
  label = "Inscribir",
  lockedPerson,
  lockedSegment,
  personOptions,
  segmentOptions,
  sequenceOptions,
  size = "sm",
  variant = "outline",
}: SequenceEnrollmentButtonProps) {
  const [open, setOpen] = React.useState(false);
  const disabled = !sequenceOptions.some((option) => option.canEnroll);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <UserPlus />
        {label}
      </Button>
      {open ? (
        <SequenceEnrollmentDialog
          key={`${defaultSequenceId ?? "sequence"}-${lockedPerson?.id ?? "audience"}`}
          defaultSequenceId={defaultSequenceId}
          lockedPerson={lockedPerson}
          lockedSegment={lockedSegment}
          onOpenChange={setOpen}
          open={open}
          personOptions={personOptions}
          segmentOptions={segmentOptions}
          sequenceOptions={sequenceOptions}
        />
      ) : null}
    </>
  );
}

export function SequenceEnrollmentDialog({
  defaultSequenceId,
  lockedPerson,
  lockedSegment,
  onOpenChange,
  open,
  personOptions,
  segmentOptions,
  sequenceOptions,
}: SequenceEnrollmentDialogProps) {
  const router = useRouter();
  const activeSequences = sequenceOptions.filter((option) => option.canEnroll);
  const [sequenceId, setSequenceId] = React.useState(() =>
    firstEnrollSequence(sequenceOptions, defaultSequenceId),
  );
  const [source, setSource] = React.useState<"person" | "segment">(
    lockedSegment ? "segment" : "person",
  );
  const [personId, setPersonId] = React.useState(lockedPerson?.id ?? "");
  const [segmentId, setSegmentId] = React.useState(
    lockedSegment?.id ?? segmentOptions[0]?.id ?? "",
  );
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<SequenceEnrollmentResult | null>(
    null,
  );

  const canSubmit =
    Boolean(sequenceId) &&
    (lockedPerson || lockedSegment
      ? true
      : source === "person"
        ? Boolean(personId)
        : Boolean(segmentId));

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setResult(null);
    try {
      const next = await enrollInSequence({
        personId: lockedPerson?.id ?? (source === "person" ? personId : null),
        segmentId:
          lockedSegment?.id ?? (source === "segment" ? segmentId : null),
        sequenceId,
        source: lockedSegment ? "segment" : source,
      });
      setResult(next);
      toast.success(resultMessage(next));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo inscribir",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Inscribir en secuencia</DialogTitle>
          <DialogDescription>
            {lockedPerson
              ? lockedPerson.name
              : lockedSegment
                ? lockedSegment.name
                : "Contacto o segmento"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Secuencia</Label>
            <select
              className={selectClass}
              value={sequenceId}
              onChange={(event) => setSequenceId(event.target.value)}
            >
              {activeSequences.length === 0 ? (
                <option value="">No hay secuencias activas</option>
              ) : null}
              {sequenceOptions.map((sequence) => (
                <option
                  key={sequence.id}
                  value={sequence.id}
                  disabled={!sequence.canEnroll}
                >
                  {sequence.name}
                  {!sequence.canEnroll
                    ? sequence.status === "active"
                      ? " · sin pasos"
                      : " · no activa"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {lockedPerson || lockedSegment ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">
                {lockedPerson?.name ?? lockedSegment?.name}
              </div>
              <div className="text-muted-foreground mt-0.5 break-all">
                {lockedPerson
                  ? (lockedPerson.email ?? "Sin email")
                  : "Segmento seleccionado"}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label>Origen</Label>
                <select
                  className={selectClass}
                  value={source}
                  onChange={(event) =>
                    setSource(event.target.value as "person" | "segment")
                  }
                >
                  <option value="person">Contacto</option>
                  <option value="segment">Segmento</option>
                </select>
              </div>

              {source === "person" ? (
                <div className="grid gap-1.5">
                  <Label>Contacto</Label>
                  <select
                    className={selectClass}
                    value={personId}
                    onChange={(event) => setPersonId(event.target.value)}
                  >
                    <option value="">Elige un contacto</option>
                    {personOptions.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                        {person.email ? ` · ${person.email}` : " · sin email"}
                      </option>
                    ))}
                  </select>
                  {personId ? (
                    <div className="flex flex-wrap gap-2">
                      {personOptions
                        .filter((person) => person.id === personId)
                        .map((person) => (
                          <Badge key={person.id} variant="secondary">
                            {marketingLabels[person.marketingStatus] ??
                              person.marketingStatus}
                          </Badge>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label>Segmento</Label>
                  <select
                    className={selectClass}
                    value={segmentId}
                    onChange={(event) => setSegmentId(event.target.value)}
                  >
                    {segmentOptions.length === 0 ? (
                      <option value="">No hay segmentos</option>
                    ) : null}
                    {segmentOptions.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {result ? (
            <div className="grid gap-2 rounded-md border p-3">
              <div className="text-sm font-medium">{resultMessage(result)}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {resultItems(result).map(([label, value]) => (
                  <div key={label} className="bg-muted rounded-md px-2 py-1.5">
                    <div className="text-muted-foreground text-[0.68rem]">
                      {label}
                    </div>
                    <div className="text-sm font-medium tabular-nums">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cerrar
          </Button>
          <Button type="button" onClick={submit} disabled={busy || !canSubmit}>
            <UserPlus />
            {busy ? "Inscribiendo..." : "Inscribir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
