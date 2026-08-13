import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/smartprior_db?schema=public'),
  JWT_SECRET: z.string().default('default_jwt_secret_for_development'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  AI_PROVIDER: z.string().default('openai'),
  AI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
