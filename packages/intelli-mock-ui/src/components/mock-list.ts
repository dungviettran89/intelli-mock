import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/list/list';
import '@material/web/list/list-item';
import '@material/web/progress/circular-progress';
import '@material/web/icon/icon';
import type { MockEndpoint } from '../services/api.js';

/**
 * Mock List component — displays a list of mock endpoints.
 * Uses Lit Element + Material Web Components.
 */
@customElement('mock-list')
export class MockList extends LitElement {
  static override styles = css`
    :host {
      display: block;
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 500;
      margin: 0;
    }

    .empty {
      text-align: center;
      padding: 48px 16px;
      color: #666;
    }

    .error {
      color: #b3261e;
      padding: 16px;
      background: #f9dedc;
      border-radius: 8px;
      margin: 16px 0;
    }

    .method-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #fff;
      min-width: 60px;
      text-align: center;
    }

    .method-GET { background: #0d9488; }
    .method-POST { background: #2563eb; }
    .method-PUT { background: #d97706; }
    .method-PATCH { background: #7c3aed; }
    .method-DELETE { background: #dc2626; }
    .method-HEAD { background: #6b7280; }
    .method-OPTIONS { background: #6b7280; }
    .method-ANY { background: #6b7280; }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 6px;
    }

    .status-active { background: #16a34a; }
    .status-ready { background: #2563eb; }
    .status-draft { background: #6b7280; }
    .status-deactivated { background: #dc2626; }

    md-list-item {
      cursor: pointer;
    }

    md-list-item:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  `;

  @state()
  private _mocks: MockEndpoint[] = [];

  @state()
  private _loading = true;

  @state()
  private _error: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    void this._fetchMocks();
  }

  private async _fetchMocks(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const res = await fetch('/api/mocks');
      if (!res.ok) {
        throw new Error(`Failed to fetch mocks: HTTP ${res.status}`);
      }
      this._mocks = (await res.json()) as MockEndpoint[];
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load mocks';
      this._mocks = [];
    } finally {
      this._loading = false;
    }
  }

  private _methodClass(method: string): string {
    return `method-badge method-${method.toUpperCase()}`;
  }

  private _statusClass(status: string): string {
    return `status-dot status-${status.toLowerCase()}`;
  }

  override render() {
    if (this._loading) {
      return html`
        <div class="header">
          <h1>Intelli-Mock</h1>
        </div>
        <div style="display:flex;justify-content:center;padding:48px;">
          <md-circular-progress indeterminate></md-circular-progress>
        </div>
      `;
    }

    if (this._error) {
      return html`
        <div class="header">
          <h1>Intelli-Mock</h1>
        </div>
        <div class="error">${this._error}</div>
      `;
    }

    if (this._mocks.length === 0) {
      return html`
        <div class="header">
          <h1>Intelli-Mock</h1>
        </div>
        <div class="empty">
          <md-icon style="font-size:48px;width:48px;height:48px;">code</md-icon>
          <p>No mock endpoints yet.</p>
          <p>Create your first mock to get started.</p>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Intelli-Mock</h1>
        <span style="color:#666;">${this._mocks.length} mock${this._mocks.length !== 1 ? 's' : ''}</span>
      </div>
      <md-list>
        ${this._mocks.map(
          (mock) => html`
            <md-list-item>
              <div slot="headline">
                <span class="${this._methodClass(mock.method)}">${mock.method}</span>
                <span style="margin-left:8px;font-family:monospace;">${mock.pathPattern}</span>
              </div>
              <div slot="supporting-text">
                <span class="${this._statusClass(mock.status)}"></span>
                ${mock.status}
                ${mock.proxyUrl ? html`<span style="margin-left:12px;">→ ${mock.proxyUrl}</span>` : ''}
              </div>
              <div slot="end">${mock.priority > 0 ? html`<span style="color:#666;font-size:12px;">P${mock.priority}</span>` : ''}</div>
            </md-list-item>
          `,
        )}
      </md-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mock-list': MockList;
  }
}
