import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, { message: "Senha deve ter pelo menos 10 caracteres." })
  .regex(/[a-z]/, { message: "Inclua pelo menos uma letra minúscula." })
  .regex(/[A-Z]/, { message: "Inclua pelo menos uma letra maiúscula." })
  .regex(/[0-9]/, { message: "Inclua pelo menos um número." })
  .regex(/[^A-Za-z0-9]/, { message: "Inclua pelo menos um símbolo." });

export const resetFormSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem.",
    path: ["confirm"],
  });

export type ResetFormInput = z.infer<typeof resetFormSchema>;
