import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@/components/sample-editor.js';
import type { SamplePair } from '@/services/api.js';

describe('SampleEditor component', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let element: any;

  const mockSamples: SamplePair[] = [
    {
      id: 'sample-1',
      endpointId: 'endpoint-1',
      source: 'manual',
      request: { method: 'GET', url: '/api/users' },
      response: { status: 200, body: { users: [] } },
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sample-2',
      endpointId: 'endpoint-1',
      source: 'captured',
      request: { method: 'POST', url: '/api/users', body: { name: 'John' } },
      response: { status: 201, body: { id: '123', name: 'John' } },
      createdAt: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockSamples),
    });
    global.fetch = fetchMock;
    element = document.createElement('sample-editor');
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
    expect(element.shadowRoot?.textContent).toContain('Sample Pairs');
  });

  it('should fetch samples on connected', async () => {
    await waitForRender();
    expect(fetchMock).toHaveBeenCalledWith('/api/samples');
  });

  it('should render list of samples after fetch', async () => {
    await waitForRender();
    await waitForRender();

    const shadowRoot = element.shadowRoot!;
    expect(shadowRoot.textContent).toContain('2 samples');
    expect(shadowRoot.textContent).toContain('manual');
    expect(shadowRoot.textContent).toContain('captured');
  });

  it('should display source badges with correct classes', async () => {
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.innerHTML).toContain('source-badge source-manual');
    expect(element.shadowRoot?.innerHTML).toContain('source-badge source-captured');
  });

  it('should show JSON previews for request and response', async () => {
    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('Request');
    expect(element.shadowRoot?.textContent).toContain('Response');
    expect(element.shadowRoot?.textContent).toContain('"method": "GET"');
    expect(element.shadowRoot?.textContent).toContain('"status": 200');
  });

  it('should show empty state when no samples exist', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue([]),
    });

    element.remove();
    element = document.createElement('sample-editor');
    document.body.appendChild(element);

    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('No sample pairs yet');
    expect(element.shadowRoot?.textContent).toContain('Add your first sample');
  });

  it('should handle fetch errors gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    });

    element.remove();
    element = document.createElement('sample-editor');
    document.body.appendChild(element);

    await waitForRender();
    await waitForRender();

    expect(element.shadowRoot?.textContent).toContain('Failed to fetch samples: HTTP 500');
  });

  it('should filter samples by endpointId when provided', async () => {
    element.remove();
    element = document.createElement('sample-editor');
    element.endpointId = 'endpoint-1';
    document.body.appendChild(element);

    await waitForRender();

    expect(fetchMock).toHaveBeenCalledWith('/api/samples?endpointId=endpoint-1');
  });

  it('should open dialog when Add Sample is clicked', async () => {
    await waitForRender();
    await waitForRender();

    const addButton = element.shadowRoot?.querySelector('md-filled-button');
    addButton?.click();
    await element.updateComplete;

    expect(element._dialogOpen).toBe(true);
    expect(element._editingSample).toBe(null);
  });

  it('should create new sample via POST when dialog is saved', async () => {
    await waitForRender();
    await waitForRender();

    // Set form data directly without opening dialog
    element._formData = {
      endpointId: 'endpoint-1',
      source: 'manual',
      request: '{"method":"GET"}',
      response: '{"status":200}',
    };
    element._editingSample = null;

    // Clear previous mock calls and setup fresh POST response
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({ id: 'sample-3' }),
    });

    // Save
    await element._onDialogSave();
    await element.updateComplete;
    await waitForRender();

    // Verify POST was called
    const postCall = fetchMock.mock.calls.find(
      (call: any[]) => call[1]?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    expect(postCall[0]).toBe('/api/samples');
    // Dialog should close after successful save
    expect(element._dialogOpen).toBe(false);
  });

  it('should handle invalid JSON in form validation', async () => {
    await waitForRender();
    await waitForRender();

    element._onAddSample();
    await element.updateComplete;

    element._formData = {
      endpointId: 'endpoint-1',
      source: 'manual',
      request: 'invalid json',
      response: '{"status":200}',
    };

    await element._onDialogSave();
    await element.updateComplete;

    expect(element._result?.success).toBe(false);
    expect(element._result?.message).toContain('Invalid JSON');
  });

  it('should delete sample with confirmation', async () => {
    await waitForRender();
    await waitForRender();

    // Mock confirmation dialog
    vi.spyOn(global, 'confirm').mockReturnValue(true);

    // Clear previous mock calls and setup DELETE response
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const sample = mockSamples[0];
    await element._onDeleteSample(sample);
    await element.updateComplete;
    await waitForRender();

    // Verify DELETE was called
    const deleteCall = fetchMock.mock.calls.find(
      (call: any[]) => call[1]?.method === 'DELETE',
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall[0]).toBe(`/api/samples/${sample.id}`);
    // Should refetch samples after delete
    expect(fetchMock).toHaveBeenCalledWith('/api/samples');
  });

  it('should populate form when editing existing sample', async () => {
    await waitForRender();
    await waitForRender();

    const sample = mockSamples[0];
    element._onEditSample(sample);
    await element.updateComplete;

    expect(element._dialogOpen).toBe(true);
    expect(element._editingSample).toBe(sample);
    expect(element._formData.endpointId).toBe(sample.endpointId);
    expect(element._formData.source).toBe(sample.source);
  });
});
