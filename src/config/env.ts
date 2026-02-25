import process from 'process';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  PORT: z.coerce.number().default(3000),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('12m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .catch('false')
    .transform((val) => val === 'true'),

  // Logs
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).catch('info'),

  // Ambiente
  NODE_ENV: z.enum(['development', 'production', 'test']).catch('development'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),
});

export const env = envSchema.parse(process.env);
