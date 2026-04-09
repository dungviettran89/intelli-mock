import { describe, it, expect, vi } from 'vitest';
import { loadAppConfig, getConfig, resetConfig } from '@src/config/env.js';

describe('loadAppConfig', () => {
  it('should throw when JWT_PUBLIC_KEY is missing', () => {
    delete process.env.JWT_PUBLIC_KEY;
    expect(() => loadAppConfig()).toThrow('Missing required env var: JWT_PUBLIC_KEY');
  });

  it('should load default values when only required env is set', () => {
    process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----';
    // Note: setup.ts sets PORT=0, so we test the explicit default by deleting PORT
    delete process.env.PORT;
    const config = loadAppConfig();

    expect(config.server.port).toBe(3000);
    expect(config.server.nodeEnv).toBe('test'); // setup.ts sets NODE_ENV=test
    expect(config.auth.algorithm).toBe('RS256');
    expect(config.auth.issuer).toBe('test-issuer'); // setup.ts overrides default
    expect(config.ai.provider).toBe('openai');
    expect(config.ai.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.ai.model).toBe('gpt-4o');
  });

  it('should parse PORT from env', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    process.env.PORT = '8080';
    const config = loadAppConfig();
    expect(config.server.port).toBe(8080);
  });

  it('should parse NODE_ENV from env', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    const config = loadAppConfig();
    expect(config.server.nodeEnv).toBe('production');
  });

  it('should parse CORS origins from comma-separated string', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    process.env.CORS_ORIGINS = 'http://a.com,http://b.com';
    const config = loadAppConfig();
    expect(config.security.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
  });

  it('should parse allowed headers from comma-separated string', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    process.env.ALLOWED_HEADERS = 'header1, header2';
    const config = loadAppConfig();
    expect(config.security.allowedHeaders).toEqual(['header1', 'header2']);
  });

  it('should use inline PEM key directly', () => {
    const pemKey = '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----';
    process.env.JWT_PUBLIC_KEY = pemKey;
    const config = loadAppConfig();
    expect(config.auth.publicKey).toBe(pemKey);
  });

  it('should override AI config from env', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    process.env.AI_PROVIDER = 'anthropic';
    process.env.AI_BASE_URL = 'https://api.anthropic.com/v1';
    process.env.AI_API_KEY = 'test-api-key';
    process.env.AI_MODEL = 'claude-3';
    const config = loadAppConfig();
    expect(config.ai.provider).toBe('anthropic');
    expect(config.ai.baseUrl).toBe('https://api.anthropic.com/v1');
    expect(config.ai.apiKey).toBe('test-api-key');
    expect(config.ai.model).toBe('claude-3');
  });
});

describe('getConfig', () => {
  it('should cache the config instance', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    const config1 = getConfig();
    const config2 = getConfig();
    expect(config1).toBe(config2);
  });

  it('should reload after resetConfig', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    const config1 = getConfig();
    resetConfig();
    const config2 = getConfig();
    expect(config1).not.toBe(config2);
  });
});

describe('resetConfig', () => {
  it('should clear the cached config', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    getConfig();
    resetConfig();
    expect(() => getConfig()).not.toThrow();
  });
});
