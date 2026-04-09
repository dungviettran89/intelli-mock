import { injectable } from 'tsyringe';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * ScriptValidator performs syntax validation on JavaScript code strings.
 * Uses `new Function()` to parse without executing the code.
 */
@injectable()
export class ScriptValidator {
  /**
   * Validates JavaScript code syntax without executing it.
   * @param code - The JavaScript code to validate
   * @returns ValidationResult with valid status and optional error message
   */
  validate(code: string): ValidationResult {
    // Check for empty or whitespace-only code
    if (!code || typeof code !== 'string') {
      return {
        valid: false,
        error: 'Code must be a non-empty string',
      };
    }

    const trimmed = code.trim();
    if (trimmed.length === 0) {
      return {
        valid: false,
        error: 'Code must not be empty or whitespace-only',
      };
    }

    // Use `new Function()` to parse the code without executing it
    try {
      // eslint-disable-next-line @typescript-eslint/no-new-func
      new Function(trimmed);
      return { valid: true };
    } catch (err: any) {
      return {
        valid: false,
        error: err.message || 'Syntax error in code',
      };
    }
  }
}
