/**
 * MCP Server — Environment Config Validation
 *
 * Validates and exposes environment variables with strict schemas.
 * Ensures the server crashes immediately during startup with clear error messages
 * if there is a missing dependency or invalid configuration.
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the specific .env file in the server project root
dotenv.config({ path: join(__dirname, '../../.env') });

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY must be provided for the default AI model.'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL_LLAMA: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
  OPENROUTER_MODEL_DEEPSEEK: z.string().default('deepseek/deepseek-chat:free'),
  OPENROUTER_MODEL_QWEN: z.string().default('qwen/qwen-2.5-72b-instruct:free'),
  OPENROUTER_MODEL_GEMMA: z.string().default('google/gemma-2-9b-it:free'),
  OPENROUTER_MODEL_MISTRAL: z.string().default('mistralai/mistral-7b-instruct:free'),
  OPENROUTER_MODEL_DEFAULT: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
  OLLAMA_HOST: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5-coder:7b'),
  PORT: z.string().transform((v) => parseInt(v, 10)).default('3001'),
  ALLOWED_ORIGINS: z.string()
    .transform((str) => str.split(',').map((s) => s.trim().toLowerCase()))
    .default('https://gtmcontaineranalyzer.com,http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_BASE_DIR: z.string().default('.'),
});

// Run validation
let envResult: z.infer<typeof envSchema>;

try {
  envResult = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const issues = error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    console.error('❌ Configuration error: Environment variables validation failed:\n' + issues);
    process.exit(1);
  }
  throw error;
}

export const env = envResult;
