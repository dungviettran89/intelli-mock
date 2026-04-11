import { type FullConfig } from '@playwright/test';

/**
 * Global setup runs once before all tests.
 * Use it to prepare the test environment.
 */
async function globalSetup(config: FullConfig) {
  // Clear database via direct API call before tests start
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/mocks`);
    if (res.ok) {
      const mocks = await res.json();
      for (const mock of mocks) {
        await fetch(`${baseUrl}/api/mocks/${mock.id}`, { method: 'DELETE' });
      }
      console.log(`[GlobalSetup] Cleared ${mocks.length} mocks from database`);
    }
  } catch (err) {
    console.warn('[GlobalSetup] Failed to clear database (it may be empty):', err);
  }
}

export default globalSetup;
