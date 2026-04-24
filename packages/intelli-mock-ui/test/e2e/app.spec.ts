import { test, expect } from './setup.js';

test.describe('Intelli-Mock E2E', () => {
  
  test.describe('App Shell & Navigation', () => {
    test('should render the app-shell component with sidebar and header', async ({ page }) => {
      const appShell = page.locator('app-shell');
      await expect(appShell).toBeAttached();

      const sidebar = page.locator('app-shell aside');
      const header = page.locator('app-shell header');

      await expect(sidebar).toBeVisible();
      await expect(header).toBeVisible();
    });

    test('should navigate between views using the sidebar', async ({ page }) => {
      // By default, it should render mock-list
      await expect(page.locator('mock-list')).toBeAttached();

      // Click on Settings
      const settingsLink = page.locator('app-shell a.nav-link:has-text("Settings")');
      await settingsLink.click();

      // Settings panel should now be visible
      await expect(page.locator('settings-panel')).toBeAttached();
      await expect(page.locator('mock-list')).not.toBeAttached();

      // Click back to Mocks
      const mocksLink = page.locator('app-shell a.nav-link:has-text("Mocks")');
      await mocksLink.click();

      // Mock-list should be back
      await expect(page.locator('mock-list')).toBeAttached();
    });
  });

  test.describe('Mock List functionality', () => {
    test('should call the API to fetch mocks', async ({ page }) => {
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('/api/mocks')
      );
      
      await page.reload();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
    });

    test('should create and display mocks when data exists', async ({ page }) => {
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
      
      expect(result.length).toBe(2);
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.locator('mock-list')).toBeAttached();
      
      // Check for content in the list
      await expect(page.getByText('/api/users')).toBeVisible();
      await expect(page.getByText('/api/posts')).toBeVisible();
    });
  });

  test.describe('Settings Panel functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('app-shell a.nav-link:has-text("Settings")').click();
      await expect(page.locator('settings-panel')).toBeAttached();
    });

    test('should render the settings sections', async ({ page }) => {
      const settingsPanel = page.locator('settings-panel');
      await expect(settingsPanel.getByText('Tenant Configuration')).toBeVisible();
      await expect(settingsPanel.getByText('AI Orchestration')).toBeVisible();
    });

    test('should interact with AI Provider and Model inputs', async ({ page }) => {
      const settingsPanel = page.locator('settings-panel');
      const modelSelect = settingsPanel.locator('select');
      await expect(modelSelect).toBeVisible();

      await modelSelect.selectOption('ollama-llama3');
      await expect(modelSelect).toHaveValue('ollama-llama3');
      
      const endpointInput = settingsPanel.locator('input[type="text"]').first();
      await endpointInput.fill('http://localhost:11434/v1');
      await expect(endpointInput).toHaveValue('http://localhost:11434/v1');
    });
  });
});
