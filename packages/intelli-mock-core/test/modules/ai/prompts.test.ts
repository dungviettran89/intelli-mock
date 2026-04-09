import { describe, it, expect } from 'vitest';
import { createUserPrompt, createTestPrompt, SYSTEM_PROMPT, SamplePairForPrompt } from '../../../src/modules/ai/prompts';

describe('AI Prompts', () => {
  describe('SYSTEM_PROMPT', () => {
    it('should define the AI role and output format', () => {
      expect(SYSTEM_PROMPT).toContain('expert JavaScript developer');
      expect(SYSTEM_PROMPT).toContain('mock API handlers');
      expect(SYSTEM_PROMPT).toContain('module.exports');
    });

    it('should document available utilities', () => {
      expect(SYSTEM_PROMPT).toContain('ctx.utils.delay');
      expect(SYSTEM_PROMPT).toContain('ctx.utils.random');
      expect(SYSTEM_PROMPT).toContain('ctx.utils.pick');
      expect(SYSTEM_PROMPT).toContain('ctx.utils.oneOf');
    });

    it('should specify output requirements', () => {
      expect(SYSTEM_PROMPT).toContain('status');
      expect(SYSTEM_PROMPT).toContain('headers');
      expect(SYSTEM_PROMPT).toContain('body');
    });

    it('should request no markdown formatting', () => {
      expect(SYSTEM_PROMPT).toContain('Do NOT include markdown formatting');
    });
  });

  describe('createUserPrompt', () => {
    const samples: SamplePairForPrompt[] = [
      {
        request: { method: 'GET', path: '/api/users/1', params: { id: '1' } },
        response: { status: 200, body: { id: 1, name: 'John' } },
      },
    ];

    it('should format endpoint information', () => {
      const prompt = createUserPrompt(samples, '/api/users/:id', 'GET');
      expect(prompt).toContain('/api/users/:id');
      expect(prompt).toContain('GET');
    });

    it('should format sample request details', () => {
      const prompt = createUserPrompt(samples, '/api/users/:id', 'GET');
      expect(prompt).toContain('Sample 1');
      expect(prompt).toContain('Method: GET');
      expect(prompt).toContain('Path: /api/users/1');
      expect(prompt).toContain('Params:');
    });

    it('should format sample response', () => {
      const prompt = createUserPrompt(samples, '/api/users/:id', 'GET');
      expect(prompt).toContain('Status: 200');
      expect(prompt).toContain('Body:');
    });

    it('should include optional prompt extra', () => {
      const prompt = createUserPrompt(
        samples,
        '/api/users/:id',
        'GET',
        'Handle pagination',
      );
      expect(prompt).toContain('Additional Requirements');
      expect(prompt).toContain('Handle pagination');
    });

    it('should handle multiple samples', () => {
      const multipleSamples: SamplePairForPrompt[] = [
        {
          request: { method: 'GET', path: '/api/users/1' },
          response: { status: 200, body: { id: 1 } },
        },
        {
          request: { method: 'GET', path: '/api/users/2' },
          response: { status: 200, body: { id: 2 } },
        },
      ];
      const prompt = createUserPrompt(multipleSamples, '/api/users/:id', 'GET');
      expect(prompt).toContain('Sample 1');
      expect(prompt).toContain('Sample 2');
    });

    it('should handle optional fields in request/response', () => {
      const sampleWithOptional: SamplePairForPrompt[] = [
        {
          request: {
            method: 'POST',
            path: '/api/users',
            headers: { 'Content-Type': 'application/json' },
            body: { name: 'John' },
          },
          response: {
            status: 201,
            headers: { 'X-Created': 'true' },
            body: { id: 1, name: 'John' },
          },
        },
      ];
      const prompt = createUserPrompt(sampleWithOptional, '/api/users', 'POST');
      expect(prompt).toContain('Headers:');
      expect(prompt).toContain('Body:');
    });
  });

  describe('createTestPrompt', () => {
    it('should return a simple test prompt', () => {
      const prompt = createTestPrompt();
      expect(prompt).toContain('simple mock handler');
      expect(prompt).toContain('status: 200');
    });
  });
});
