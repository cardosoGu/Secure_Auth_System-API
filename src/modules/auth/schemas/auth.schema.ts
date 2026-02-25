import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(16, 'Senha deve ter no máximo 16 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve ter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve ter pelo menos um número')
  .regex(/[^a-zA-Z0-9]/, 'Senha deve ter pelo menos um caractere especial');

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().toLowerCase().trim(),
  password: passwordSchema,
});

export const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
