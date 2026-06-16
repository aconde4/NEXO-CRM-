"use client";

import * as React from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContactFormDialog,
  type ContactInitial,
  type OrgOption,
} from "@/components/contacts/contact-form-dialog";

export function EditContactButton({
  contact,
  organizations,
}: {
  contact: ContactInitial;
  organizations: OrgOption[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil />
        Editar
      </Button>
      <ContactFormDialog
        open={open}
        onOpenChange={setOpen}
        organizations={organizations}
        contact={contact}
      />
    </>
  );
}
