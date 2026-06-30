import { z } from "zod";

const optionalUuid = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .refine((v) => !v || z.string().uuid().safeParse(v).success, "Id no válido")
  .transform((v) => (v ? v : null));

export const productFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Ponle un nombre").max(200),
  description: z.string().trim().max(2_000).default(""),
  unitPrice: z
    .number({ message: "Indica un precio" })
    .min(0, "No puede ser negativo")
    .max(1_000_000_000),
});

export const quoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  productId: optionalUuid,
  name: z.string().trim().min(1, "Indica el concepto").max(200),
  description: z.string().trim().max(1_000).default(""),
  quantity: z.number().min(0, "No puede ser negativo").max(1_000_000),
  unitPrice: z.number().min(0, "No puede ser negativo").max(1_000_000_000),
});

export const quoteFormSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Ponle un título").max(200),
  dealId: optionalUuid,
  status: z.enum(["draft", "sent", "accepted", "rejected"]),
  taxRate: z.number().min(0, "No puede ser negativo").max(100, "Máximo 100%"),
  notes: z.string().trim().max(5_000).default(""),
  items: z.array(quoteItemSchema).max(100, "Demasiadas líneas"),
});

export const productIdSchema = z.string().uuid("Producto no válido");
export const quoteIdSchema = z.string().uuid("Presupuesto no válido");

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type QuoteFormValues = z.infer<typeof quoteFormSchema>;
export type QuoteItemValues = z.infer<typeof quoteItemSchema>;
