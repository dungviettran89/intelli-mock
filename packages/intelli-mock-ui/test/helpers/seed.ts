/**
 * Clears all data from the database via API for test isolation.
 * This runs in the browser context, so uses relative URLs.
 */
export async function clearDatabase(): Promise<void> {
  // Fetch all mocks and delete them
  const res = await fetch('/api/mocks');
  if (res.ok) {
    const mocks = await res.json();
    for (const mock of mocks) {
      await fetch(`/api/mocks/${mock.id}`, { method: 'DELETE' });
    }
  }
}
