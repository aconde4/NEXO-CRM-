"use client";

import * as React from "react";
import { Pencil } from "lucide-react";

import type { CustomFieldDef } from "@/lib/custom-fields";
import { Button } from "@/components/ui/button";
import {
  OrganizationFormDialog,
  type OrganizationInitial,
} from "@/components/organizations/organization-form-dialog";

export function EditOrganizationButton({
  organization,
  customFieldDefs = [],
}: {
  organization: OrganizationInitial;
  customFieldDefs?: CustomFieldDef[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil />
        Editar
      </Button>
      <OrganizationFormDialog
        open={open}
        onOpenChange={setOpen}
        organization={organization}
        customFieldDefs={customFieldDefs}
      />
    </>
  );
}
