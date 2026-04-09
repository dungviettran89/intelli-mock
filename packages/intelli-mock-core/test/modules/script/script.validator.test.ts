import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptValidator } from '../../../src/modules/script/script.validator';

describe('ScriptValidator', () => {
  let validator: ScriptValidator;

  beforeEach(() => {
    validator = new ScriptValidator();
  });

  it('should return valid: true for valid JavaScript code', () => {
    const result = validator.validate('const x = 42;');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return valid: true for a function definition', () => {
    const code = `
      module.exports = async (req, ctx) => {
        return { status: 200, body: { ok: true } };
      };
    `;
    const result = validator.validate(code);
    expect(result.valid).toBe(true);
  });

  it('should return valid: true for complex valid code', () => {
    const code = `
      const handler = async (req, ctx) => {
        const { id } = req.params;
        await ctx.utils.delay(100);
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { message: 'Hello', id }
        };
      };
      module.exports = handler;
    `;
    const result = validator.validate(code);
    expect(result.valid).toBe(true);
  });

  it('should return valid: false for syntax errors', () => {
    const result = validator.validate('const x = {');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Unexpected|Syntax/);
  });

  it('should return valid: false for unclosed string', () => {
    const result = validator.validate("const msg = 'hello");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return valid: false for empty string', () => {
    const result = validator.validate('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Code must be a non-empty string');
  });

  it('should return valid: false for whitespace-only string', () => {
    const result = validator.validate('   \n\t  ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Code must not be empty or whitespace-only');
  });

  it('should return valid: false for non-string input (undefined)', () => {
    const result = validator.validate(undefined as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Code must be a non-empty string');
  });

  it('should return valid: false for non-string input (number)', () => {
    const result = validator.validate(42 as any);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Code must be a non-empty string');
  });

  it('should trim whitespace before validation', () => {
    const code = `
      const valid = true;
    `;
    const result = validator.validate(code);
    expect(result.valid).toBe(true);
  });

  it('should catch missing parentheses in function call', () => {
    const result = validator.validate('console.log "hello"');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should catch invalid operator', () => {
    const result = validator.validate('const x = 5 ++ 3');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should validate arrow function syntax', () => {
    const code = 'const fn = (a, b) => a + b;';
    const result = validator.validate(code);
    expect(result.valid).toBe(true);
  });

  it('should validate async/await syntax', () => {
    const code = 'const fn = async () => { await Promise.resolve(); };';
    const result = validator.validate(code);
    expect(result.valid).toBe(true);
  });
});
