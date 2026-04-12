import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@/components/mock-detail.js';
import type { MockEndpoint } from '@/services/api.js';

describe('MockDetail component', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let element: any;

  const mockEndpoint: MockEndpoint = {
    id: 'mock-1',
    pathPattern: '/api/users/:id',
    method: 'GET',
    proxyUrl: 'https://api.example.com/users',
    proxyTimeoutMs: 5000,
    status: 'active',
    promptExtra: 'Test prompt extra',
    priority: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockEndpoint),
    });
    global.fetch = fetchMock;
    element = document.createElement('mock-detail');
    element.mockId = 'mock-1';
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

  it('should show loading state initially', async () => {
    await waitForRender();
    expect(element.shadowRoot?.textContent).toContain('Mock Details');
  });

  it('should fetch mock data on connected', async () => {
    await waitForRender();
    expect(fetchMock).toHaveBeenCalledWith('/api/mocks/mock-1');
  });

  it('should render mock details after fetch', async () => {
    await waitForRender();
    await waitForRender();

    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('/api/users/:id');
    expect(shadowRoot.textContent).toContain('GET');
    expect(shadowRoot.textContent).toContain('active');
    expect(shadowRoot.textContent).toContain('https://api.example.com/users');
    expect(shadowRoot.textContent).toContain('5000ms');
  });

  it('should show prompt extra when available', async () => {
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('Test prompt extra');
  });

  it('should dispatch navigate-back event', async () => {
    await waitForRender();
    await waitForRender();

    const eventPromise = new Promise((resolve) => {
      element.addEventListener('navigate-back', (e) => resolve(e));
    });

    element.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
    await eventPromise;
  });

  it('should update mockId and refetch', async () => {
    await waitForRender();
    element.mockId = 'mock-2';
    await waitForRender();

    expect(fetchMock).toHaveBeenCalledWith('/api/mocks/mock-2');
  });

  it('should show error state when mock not found', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    });
    
    element.remove();
    element = document.createElement('mock-detail');
    element.mockId = 'nonexistent';
    document.body.appendChild(element);
    
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('Mock not found');
  });

  it('should show error state on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    
    element.remove();
    element = document.createElement('mock-detail');
    element.mockId = 'error-test';
    document.body.appendChild(element);
    
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('Network error');
  });
});
