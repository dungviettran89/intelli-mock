/**
 * CLI configuration loader.
 * Merges configuration from CLI flags > environment variables > defaults.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface CliStartOptions {
  port: number;
  authDisabled: boolean;
  authKey?: string;
  authIssuer?: string;
  authAlgorithm?: string;
}

/**
 * Default configuration values.
 */
const DEFAULTS = {
  port: 3000,
  authDisabled: false,
  authIssuer: 'intelli-mock',
  authAlgorithm: 'RS256',
};

/**
 * Reads a public key from a file path or returns it as-is if it's a PEM string.
 */
function readPublicKey(value: string): string {
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
    const resolvedPath = resolve(value);
    if (!existsSync(resolvedPath)) {
      throw new Error(`JWT public key file not found: ${resolvedPath}`);
    }
    return readFileSync(resolvedPath, 'utf-8');
  }
  return value;
}

/**
 * Builds the final configuration by merging CLI flags > env vars > defaults.
 */
export function buildCliConfig(options: Partial<CliStartOptions>): CliStartOptions {
  const port = options.port !== undefined ? options.port : (process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULTS.port);
  const authDisabled = options.authDisabled !== undefined ? options.authDisabled : (process.env.AUTH_DISABLED === 'true');
  const authKey = options.authKey ?? process.env.JWT_PUBLIC_KEY;
  const authIssuer = options.authIssuer ?? process.env.JWT_ISSUER ?? DEFAULTS.authIssuer;
  const authAlgorithm = options.authAlgorithm ?? process.env.JWT_ALGORITHM ?? DEFAULTS.authAlgorithm;

  if (!authDisabled && !authKey) {
    throw new Error('Missing required auth configuration: provide --auth-key or set JWT_PUBLIC_KEY, or use --no-auth to disable auth');
  }

  return {
    port,
    authDisabled,
    authKey: authKey ? readPublicKey(authKey) : undefined,
    authIssuer,
    authAlgorithm: authAlgorithm as 'RS256' | 'ES256',
  };
}

/**
 * Applies CLI configuration to environment variables.
 * This must be called before initializing the core server.
 */
export function applyCliConfig(config: CliStartOptions): void {
  process.env.PORT = String(config.port);

  if (config.authDisabled) {
    process.env.AUTH_DISABLED = 'true';
  } else {
    process.env.AUTH_DISABLED = 'false';
    if (config.authKey) {
      process.env.JWT_PUBLIC_KEY = config.authKey;
    }
    if (config.authIssuer) {
      process.env.JWT_ISSUER = config.authIssuer;
    }
    if (config.authAlgorithm) {
      process.env.JWT_ALGORITHM = config.authAlgorithm;
    }
  }
}
