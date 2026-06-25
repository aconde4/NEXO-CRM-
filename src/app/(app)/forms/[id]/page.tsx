import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  getForm,
  listFormBuilderOptions,
  listFormSubmissions,
} from "@/server/queries/forms";
import { FormBuilder } from "@/components/forms/form-builder";
import { FormSubmissions } from "@/components/forms/form-submissions";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Editar formulario" };

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [form, options, submissions, headerList] = await Promise.all([
    getForm(id),
    listFormBuilderOptions(),
    listFormSubmissions(id),
    headers(),
  ]);
  if (!form) notFound();

  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <>
      <PageHeader
        title={form.name}
        description="Define los campos del formulario y a qué campo del CRM se guardan."
      />
      <FormBuilder form={form} options={options} origin={origin} />
      <div className="mt-6">
        <FormSubmissions submissions={submissions} fields={form.fields} />
      </div>
    </>
  );
}
