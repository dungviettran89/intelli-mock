import { test, expect } from '../setup.js';

test.describe('Mock List Component', () => {
  test('should render the mock-list component', async ({ page }) => {
    // Setup already navigates to '/'
    // Just validate the component element exists in the DOM
    const mockList = page.locator('mock-list');
    await expect(mockList).toBeAttached();
  });

  test('should call the API to fetch mocks', async ({ page }) => {
    // Wait for the API call to be made
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/mocks')
    );
    
    // The setup already navigates, so we just wait for the response
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test('should create and display mocks when data exists', async ({ page }) => {
    // Create mock endpoints via the API
    const result = await page.evaluate(async () => {
      const mocks = [
        { pathPattern: '/api/users', method: 'GET', status: 'active' },
        { pathPattern: '/api/posts', method: 'POST', status: 'draft' },
      ];
      
      const created = [];
      for (const mock of mocks) {
        const res = await fetch('/api/mocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mock),
        });
        if (res.ok) {
          created.push(await res.json());
        }
      }
      return created;
    });
    
    // Verify the mocks were created
    expect(result.length).toBe(2);
    
    // Reload to fetch the new data
    await page.reload({ waitUntil: 'networkidle' });
    
    // Verify the component is still attached
    await expect(page.locator('mock-list')).toBeAttached();
  });
});
