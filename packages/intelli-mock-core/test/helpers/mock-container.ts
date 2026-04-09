import { container } from 'tsyringe';

/**
 * Clears all tsyringe container registrations and instances.
 * Call this in afterEach to prevent state leakage between tests.
 *
 * NOTE: This accesses internal tsyringe properties. It is safe for
 * test environments only — never use in production code.
 */
export function resetContainer(): void {
  // Clear the internal registry and instance cache
  (container as any)._registry?.clear();
  (container as any)._instances?.clear();
}
