"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import {
  ActivityFormDialog,
  type EntityOption,
} from "@/components/activities/activity-form-dialog";
import { Button } from "@/components/ui/button";

export function NewActivityButton({
  persons = [],
  organizations = [],
  variant = "default",
  size,
  label = "Nueva actividad",
  lockedPersonId,
  lockedOrgId,
}: {
  persons?: EntityOption[];
  organizations?: EntityOption[];
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
  lockedPersonId?: string;
  lockedOrgId?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <Plus />
        {label}
      </Button>
      <ActivityFormDialog
        open={open}
        onOpenChange={setOpen}
        persons={persons}
        organizations={organizations}
        lockedPersonId={lockedPersonId}
        lockedOrgId={lockedOrgId}
      />
    </>
  );
}
