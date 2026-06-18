"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { DealStatus } from "@/server/db/schema";
import {
  deleteDeal,
  reopenDeal,
  setDealLost,
  setDealWon,
} from "@/server/actions/deals";
import {
  DealFormDialog,
  type DealInitial,
  type Option,
} from "@/components/deals/deal-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function DealActions({
  deal,
  status,
  pipelines,
  stagesByPipeline,
  persons,
  organizations,
}: {
  deal: DealInitial;
  status: DealStatus;
  pipelines: Option[];
  stagesByPipeline: Record<string, Option[]>;
  persons: Option[];
  organizations: Option[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [lostOpen, setLostOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function win() {
    try {
      await setDealWon(deal.id);
      toast.success("Negocio ganado 🎉");
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function reopen() {
    try {
      await reopenDeal(deal.id);
      toast.success("Negocio reabierto");
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil />
        Editar
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="Más acciones" />}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "open" ? (
            <>
              <DropdownMenuItem onClick={win}>
                <Trophy />
                Marcar ganado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLostOpen(true)}>
                <X />
                Marcar perdido
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={reopen}>
              <RotateCcw />
              Reabrir
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DealFormDialog
        open={editing}
        onOpenChange={setEditing}
        deal={deal}
        pipelines={pipelines}
        stagesByPipeline={stagesByPipeline}
        persons={persons}
        organizations={organizations}
      />

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent showCloseButton={false}>
          {lostOpen ? (
            <LostBody dealId={deal.id} onClose={() => setLostOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Eliminar el negocio?</DialogTitle>
            <DialogDescription>
              Se eliminará{" "}
              <span className="text-foreground font-medium">{deal.title}</span>.
              Podrás recuperarlo más adelante (borrado reversible).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await deleteDeal(deal.id);
                  toast.success("Negocio eliminado");
                  router.push("/deals");
                } catch {
                  toast.error("No se pudo eliminar");
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LostBody({
  dealId,
  onClose,
}: {
  dealId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await setDealLost(dealId, reason);
      toast.success("Negocio marcado como perdido");
      onClose();
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Marcar como perdido</DialogTitle>
        <DialogDescription>
          Opcional: indica el motivo de la pérdida para tus informes.
        </DialogDescription>
      </DialogHeader>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Precio, competencia, sin presupuesto…"
        autoFocus
      />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
        <Button variant="destructive" onClick={confirm} disabled={busy}>
          {busy ? "Guardando…" : "Marcar perdido"}
        </Button>
      </DialogFooter>
    </>
  );
}
