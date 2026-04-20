import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@/components/app-shell.js';

describe('AppShell component', () => {
  let element: any;

  beforeEach(() => {
    // Mock fetch to prevent errors when components inside the shell try to fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    element = document.createElement('app-shell');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
    vi.clearAllMocks();
  });

  async function waitForRender() {
    await new Promise((r) => setTimeout(r, 50));
    await element.updateComplete;
  }

  it('should be defined', () => {
    expect(element).toBeDefined();
  });

  it('should render the brand name', async () => {
    await waitForRender();
    expect(element.shadowRoot?.textContent).toContain('Intelli-Mock');
    expect(element.shadowRoot?.textContent).toContain('Technical Editorial');
  });

  it('should render navigation links', async () => {
    await waitForRender();
    const nav = element.shadowRoot?.querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav?.textContent).toContain('Mocks');
    expect(nav?.textContent).toContain('Traffic');
    expect(nav?.textContent).toContain('Settings');
  });

  it('should switch views when navigation links are clicked', async () => {
    await waitForRender();
    
    // Initially showing mocks
    expect(element.shadowRoot?.querySelector('mock-list')).toBeTruthy();
    
    // Click Settings
    const links = element.shadowRoot?.querySelectorAll('.nav-link');
    const settingsLink = Array.from(links as NodeListOf<HTMLElement>).find(l => l.textContent?.includes('Settings'));
    settingsLink?.click();
    
    await waitForRender();
    expect(element.shadowRoot?.querySelector('settings-panel')).toBeTruthy();
    expect(element.shadowRoot?.querySelector('mock-list')).toBeFalsy();
    
    // Click Traffic
    const trafficLink = Array.from(links as NodeListOf<HTMLElement>).find(l => l.textContent?.includes('Traffic'));
    trafficLink?.click();
    
    await waitForRender();
    expect(element.shadowRoot?.textContent).toContain('Traffic Log Viewer');
  });

  it('should render the top header with tenant info', async () => {
    await waitForRender();
    const header = element.shadowRoot?.querySelector('header');
    expect(header).toBeTruthy();
    expect(header?.textContent).toContain('Tenant: Default');
  });

  it('should render the footer with stats', async () => {
    await waitForRender();
    const footer = element.shadowRoot?.querySelector('footer.content-footer');
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain('Total Mocks:');
    expect(footer?.textContent).toContain('Hits (24h):');
  });
});
