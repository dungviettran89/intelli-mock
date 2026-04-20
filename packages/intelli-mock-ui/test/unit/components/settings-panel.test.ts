import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@/components/settings-panel.js';

describe('SettingsPanel component', () => {
  let element: any;

  beforeEach(() => {
    element = document.createElement('settings-panel');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  async function waitForRender() {
    await element.updateComplete;
    await new Promise(r => setTimeout(r, 0));
  }

  it('should be defined', () => {
    expect(element).toBeDefined();
  });

  it('should render tenant configuration', async () => {
    await waitForRender();
    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('Tenant Configuration');
    expect(shadowRoot.textContent).toContain('intelli-prod-01');
    expect(shadowRoot.textContent).toContain('Global Architecture Lab');
  });

  it('should render usage metrics', async () => {
    await waitForRender();
    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('Usage Metrics');
    expect(shadowRoot.textContent).toContain('2.4M');
    expect(shadowRoot.textContent).toContain('Monthly Quota');
  });

  it('should render AI orchestration section', async () => {
    await waitForRender();
    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('AI Orchestration');
    // Using standard elements due to test environment limitations with Material Web Components
    expect(shadowRoot.querySelector('input[type="text"]')).toBeTruthy();
    expect(shadowRoot.querySelector('select')).toBeTruthy();
  });

  it('should render security & auth section', async () => {
    await waitForRender();
    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('Security & Auth');
    expect(shadowRoot.querySelector('input[type="text"]')).toBeTruthy();
  });

  it('should render proxy engine defaults', async () => {
    await waitForRender();
    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('Proxy Engine Defaults');
    expect(shadowRoot.textContent).toContain('Fallback Strategy');
    expect(shadowRoot.querySelector('input[type="range"]')).toBeTruthy();
  });

  it('should render danger zone', async () => {
    await waitForRender();
    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('Danger Zone');
    expect(shadowRoot.textContent).toContain('Critical: Purge Environment');
  });
});
