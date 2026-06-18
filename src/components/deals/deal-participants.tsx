"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users, X } from "lucide-react";
import { toast } from "sonner";

import { fullName } from "@/lib/format";
import {
  addDealContact,
  removeDealContact,
} from "@/server/actions/deal-contacts";
import type { Option } from "@/components/deals/deal-form-dialog";
import { EntityAvatar } from "@/components/entity-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type DealParticipant = {
  id: string;
  role: string | null;
  person: { id: string; firstName: string; lastName: string | null } | null;
};

const selectClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:ring-[3px]";

export function DealParticipants({
  dealId,
  participants,
  personOptions,
}: {
  dealId: string;
  participants: DealParticipant[];
  personOptions: Option[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [personId, setPersonId] = React.useState("");
  const [role, setRole] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const taken = new Set(
    participants.map((p) => p.person?.id).filter(Boolean) as string[],
  );
  const available = personOptions.filter((p) => !taken.has(p.id));

  async function add() {
    if (!personId) return;
    setBusy(true);
    try {
      await addDealContact(dealId, { personId, role });
      toast.success("Participante añadido");
      setPersonId("");
      setRole("");
      setAdding(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo añadir",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await removeDealContact(id);
      toast.success("Participante quitado");
      router.refresh();
    } catch {
      toast.error("No se pudo quitar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="text-muted-foreground size-4" />
          Participantes
          {participants.length ? (
            <span className="text-muted-foreground text-sm font-normal">
              ({participants.length})
            </span>
          ) : null}
        </CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding((v) => !v)}
            disabled={available.length === 0 && !adding}
          >
            <Plus />
            Añadir
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding ? (
          <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row">
            <select
              className={selectClass}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              aria-label="Contacto"
            >
              <option value="">— Elige un contacto —</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Rol (opcional)"
              className="sm:w-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <Button onClick={() => void add()} disabled={busy || !personId}>
              {busy ? "Añadiendo…" : "Añadir"}
            </Button>
          </div>
        ) : null}

        {participants.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-sm">
            Sin participantes. Añade las personas implicadas en el negocio.
          </p>
        ) : (
          <ul className="divide-y">
            {participants.map((participant) => {
              const name = participant.person
                ? fullName(
                    participant.person.firstName,
                    participant.person.lastName,
                  )
                : "—";
              return (
                <li
                  key={participant.id}
                  className="group flex items-center gap-3 py-2"
                >
                  <EntityAvatar name={name} className="size-8 text-[10px]" />
                  <div className="min-w-0 flex-1">
                    {participant.person ? (
                      <Link
                        href={`/contacts/${participant.person.id}`}
                        className="hover:text-foreground block truncate text-sm font-medium underline-offset-2 hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium">
                        {name}
                      </span>
                    )}
                    {participant.role ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {participant.role}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar participante"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(participant.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
