import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .refine(
    (v) => {
      if (!v) return true;
      // Acepta "ejemplo.com" o "https://ejemplo.com"
      return /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}.*$/i.test(v);
    },
    { message: "URL no parece válida" },
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

export const newResearchSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, "Debe tener al menos 2 caracteres")
    .max(120, "Demasiado largo"),
  website: optionalUrl,
  linkedin: optionalUrl,
  notes: optionalText(1000),
});

export type NewResearchInput = z.input<typeof newResearchSchema>;
export type NewResearchValues = z.output<typeof newResearchSchema>;
