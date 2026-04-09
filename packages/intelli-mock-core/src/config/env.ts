import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ServerConfig {
  port: number;
  nodeEnv: string;
}

export interface AuthConfig {
  algorithm: 'RS256' | 'ES256';
  publicKey: string;
  issuer: string;
}

export interface AIConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface SecurityConfig {
  allowedHeaders: string[];
  corsOrigins: string[];
}

export interface AppConfig {
  server: ServerConfig;
  auth: AuthConfig;
  ai: AIConfig;
  security: SecurityConfig;
}

function readPublicKey(value: string): string {
  // If it looks like a file path, read the file
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
    const resolvedPath = resolve(value);
    if (!existsSync(resolvedPath)) {
      throw new Error(`JWT public key file not found: ${resolvedPath}`);
    }
    return readFileSync(resolvedPath, 'utf-8');
  }
  // Otherwise treat as inline PEM
  return value;
}

function parseStringList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Loads and validates all environment configuration.
 * Throws on missing required values.
 */
export function loadAppConfig(): AppConfig {
  const jwtAlgorithm = (process.env.JWT_ALGORITHM || 'RS256') as 'RS256' | 'ES256';
  const jwtPublicKeyRaw = process.env.JWT_PUBLIC_KEY || '';

  // Validate required auth config
  if (!jwtPublicKeyRaw) {
    throw new Error('Missing required env var: JWT_PUBLIC_KEY (PEM string or file path)');
  }

  return {
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    auth: {
      algorithm: jwtAlgorithm,
      publicKey: readPublicKey(jwtPublicKeyRaw),
      issuer: process.env.JWT_ISSUER || 'intelli-mock',
    },
    ai: {
      provider: process.env.AI_PROVIDER || 'openai',
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'gpt-4o',
    },
    security: {
      allowedHeaders: parseStringList(
        process.env.ALLOWED_HEADERS || 'authorization,content-type,x-tenant-id',
      ),
      corsOrigins: parseStringList(process.env.CORS_ORIGINS || 'http://localhost:5173'),
    },
  };
}

// Singleton config instance
let config: AppConfig | null = null;

/**
 * Returns the cached app config, loading it on first call.
 */
export function getConfig(): AppConfig {
  if (!config) {
    config = loadAppConfig();
  }
  return config;
}

/**
 * Resets the config cache (useful for testing).
 */
export function resetConfig(): void {
  config = null;
}
