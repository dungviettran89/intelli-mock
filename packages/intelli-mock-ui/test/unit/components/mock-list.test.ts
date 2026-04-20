import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@/components/mock-list.js';
import type { MockEndpoint } from '@/services/api.js';

describe('MockList component', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let element: any;

  const mockMocks: MockEndpoint[] = [
    {
      id: 'mock-1',
      pathPattern: '/api/users',
      method: 'GET',
      proxyUrl: null,
      proxyTimeoutMs: null,
      status: 'active',
      promptExtra: null,
      priority: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'mock-2',
      pathPattern: '/api/posts',
      method: 'POST',
      proxyUrl: 'https://api.example.com/posts',
      proxyTimeoutMs: 5000,
      status: 'draft',
      promptExtra: 'Additional context',
      priority: 1,
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockMocks),
    });
    global.fetch = fetchMock;
    element = document.createElement('mock-list');
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

  it('should show header state initially', async () => {
    await waitForRender();
    expect(element.shadowRoot?.textContent).toContain('Endpoint Registry');
  });

  it('should fetch mocks on connected', async () => {
    await waitForRender();
    expect(fetchMock).toHaveBeenCalledWith('/api/mocks');
  });

  it('should render list of mocks after fetch', async () => {
    await waitForRender();
    await waitForRender();

    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('/api/users');
    expect(shadowRoot.textContent).toContain('/api/posts');
    expect(shadowRoot.textContent).toContain('Active Architectures: 2');
  });

  it('should display method badges with correct classes', async () => {
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.innerHTML).toContain('method-badge method-GET');
    expect(element.shadowRoot?.innerHTML).toContain('method-badge method-POST');
  });

  it('should display status indicators', async () => {
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.innerHTML).toContain('status-dot status-active');
    expect(element.shadowRoot?.innerHTML).toContain('status-dot status-draft');
  });

  it('should show proxy URL when present', async () => {
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('→ https://api.example.com/posts');
  });

  it('should handle mocks with different priorities', async () => {
    await waitForRender();
    await waitForRender();

    // Verify both mocks are rendered
    expect(element.shadowRoot?.textContent).toContain('/api/users');
    expect(element.shadowRoot?.textContent).toContain('/api/posts');
  });

  it('should handle fetch errors gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });
    
    // Create new element to trigger fetch with new mock
    element.remove();
    element = document.createElement('mock-list');
    document.body.appendChild(element);
    
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('Failed to fetch mocks: HTTP 500');
  });
});
