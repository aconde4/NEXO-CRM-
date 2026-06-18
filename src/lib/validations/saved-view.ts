import { z } from "zod";

export const savedViewSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(60),
  entityType: z.enum(["person", "organization"]),
  filters: z.object({
    q: z.string().max(200).optional(),
    label: z.string().max(80).optional(),
    sort: z.string().max(40).optional(),
  }),
});
export type SavedViewValues = z.infer<typeof savedViewSchema>;
