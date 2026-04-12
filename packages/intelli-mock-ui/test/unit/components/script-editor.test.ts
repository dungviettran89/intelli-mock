import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@/components/script-editor.js';

describe('ScriptEditor component', () => {
  let element: any;

  beforeEach(() => {
    element = document.createElement('script-editor');
    element.code = 'console.log("test");';
    element.readonly = false;
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

  it('should have correct default properties', () => {
    expect(element.code).toBe('console.log("test");');
    expect(element.readonly).toBe(false);
  });

  it('should update code property', async () => {
    element.code = 'const x = 42;';
    await waitForRender();

    expect(element.code).toBe('const x = 42;');
  });

  it('should toggle readonly state', async () => {
    element.readonly = false;
    await waitForRender();
    expect(element.readonly).toBe(false);

    element.readonly = true;
    await waitForRender();
    expect(element.readonly).toBe(true);
  });

  it('should cleanup on disconnect', async () => {
    await waitForRender();
    element.remove();
    expect(element.isConnected).toBe(false);
  });

  it('should have onSave callback property', () => {
    const onSave = vi.fn();
    element.onSave = onSave;
    expect(element.onSave).toBe(onSave);
  });

  it('should render shadow root', async () => {
    await waitForRender();
    expect(element.shadowRoot).toBeDefined();
  });
});
