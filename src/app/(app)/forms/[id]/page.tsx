import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getForm, listFormBuilderOptions } from "@/server/queries/forms";
import { FormBuilder } from "@/components/forms/form-builder";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Editar formulario" };

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [form, options] = await Promise.all([
    getForm(id),
    listFormBuilderOptions(),
  ]);
  if (!form) notFound();

  return (
    <>
      <PageHeader
        title={form.name}
        description="Define los campos del formulario y a qué campo del CRM se guardan."
      />
      <FormBuilder form={form} options={options} />
    </>
  );
}
