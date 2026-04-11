import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '@material/web/button/filled-button';
import '@material/web/button/outlined-button';
import '@material/web/progress/circular-progress';
import '@material/web/icon/icon';
import '@material/web/divider/divider';
import type { MockEndpoint } from '../services/api.js';

/**
 * Mock Detail component — displays a single mock endpoint's full information.
 * Uses Lit Element + Material Web Components.
 */
@customElement('mock-detail')
export class MockDetail extends LitElement {
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
      gap: 16px;
      margin-bottom: 24px;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 500;
      margin: 0;
      flex: 1;
    }

    .error {
      color: #b3261e;
      padding: 16px;
      background: #f9dedc;
      border-radius: 8px;
      margin: 16px 0;
    }

    .empty {
      text-align: center;
      padding: 48px 16px;
      color: #666;
    }

    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
    }

    .detail-row {
      display: flex;
      align-items: baseline;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      font-weight: 500;
      color: #666;
      min-width: 140px;
      font-size: 14px;
    }

    .detail-value {
      font-size: 14px;
      flex: 1;
    }

    .monospace {
      font-family: monospace;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .method-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      color: #fff;
      min-width: 70px;
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

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      text-transform: capitalize;
    }

    .status-active {
      background: #dcfce7;
      color: #166534;
    }

    .status-ready {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-draft {
      background: #f3f4f6;
      color: #4b5563;
    }

    .status-deactivated {
      background: #fee2e2;
      color: #991b1b;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .prompt-extra {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }

    .result-box {
      margin-top: 16px;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
    }

    .result-success {
      background: #dcfce7;
      color: #166534;
    }

    .result-error {
      background: #fee2e2;
      color: #991b1b;
    }
  `;

  /** Mock endpoint ID to display. */
  @property({ type: String })
  mockId = '';

  @state()
  private _mock: MockEndpoint | null = null;

  @state()
  private _loading = true;

  @state()
  private _error: string | null = null;

  @state()
  private _generating = false;

  @state()
  private _generateResult: { success: boolean; message: string } | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.mockId) {
      void this._fetchMock();
    }
  }

  override willUpdate(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('mockId') && this.mockId) {
      void this._fetchMock();
    }
  }

  private async _fetchMock(): Promise<void> {
    this._loading = true;
    this._error = null;
    this._generateResult = null;
    try {
      const res = await fetch(`/api/mocks/${this.mockId}`);
      if (!res.ok) {
        if (res.status === 404) {
          this._error = 'Mock not found';
        } else {
          throw new Error(`Failed to fetch mock: HTTP ${res.status}`);
        }
        this._mock = null;
        return;
      }
      this._mock = (await res.json()) as MockEndpoint;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load mock';
      this._mock = null;
    } finally {
      this._loading = false;
    }
  }

  private _methodClass(method: string): string {
    return `method-badge method-${method.toUpperCase()}`;
  }

  private _statusClass(status: string): string {
    return `status-badge status-${status.toLowerCase()}`;
  }

  private _onBack(): void {
    this.dispatchEvent(new CustomEvent('navigate-back', { bubbles: true, composed: true }));
  }

  private async _onGenerate(): Promise<void> {
    if (!this._mock) return;
    this._generating = true;
    this._generateResult = null;
    try {
      const res = await fetch(`/api/mocks/${this._mock.id}/generate`, { method: 'POST' });
      const body = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        const message = (body.error as string) || (body.message as string) || 'Generation failed';
        throw new Error(message);
      }
      this._generateResult = {
        success: true,
        message: 'Script generated successfully',
      };
      // Refresh mock data to get updated status
      void this._fetchMock();
    } catch (err) {
      this._generateResult = {
        success: false,
        message: err instanceof Error ? err.message : 'Generation failed',
      };
    } finally {
      this._generating = false;
    }
  }

  override render() {
    if (this._loading) {
      return html`
        <div class="header">
          <md-outlined-button @click=${this._onBack}>
            <md-icon slot="icon">arrow_back</md-icon>
            Back
          </md-outlined-button>
          <h1>Mock Details</h1>
        </div>
        <div style="display:flex;justify-content:center;padding:48px;">
          <md-circular-progress indeterminate></md-circular-progress>
        </div>
      `;
    }

    if (this._error && !this._mock) {
      return html`
        <div class="header">
          <md-outlined-button @click=${this._onBack}>
            <md-icon slot="icon">arrow_back</md-icon>
            Back
          </md-outlined-button>
          <h1>Mock Details</h1>
        </div>
        <div class="error">${this._error}</div>
        <div style="text-align:center;margin-top:24px;">
          <md-outlined-button @click=${this._onBack}>Return to List</md-outlined-button>
        </div>
      `;
    }

    if (!this._mock) {
      return html`
        <div class="header">
          <md-outlined-button @click=${this._onBack}>
            <md-icon slot="icon">arrow_back</md-icon>
            Back
          </md-outlined-button>
          <h1>Mock Details</h1>
        </div>
        <div class="empty">
          <md-icon style="font-size:48px;width:48px;height:48px;">code_off</md-icon>
          <p>No mock endpoint selected.</p>
        </div>
      `;
    }

    return html`
      <div class="header">
        <md-outlined-button @click=${this._onBack}>
          <md-icon slot="icon">arrow_back</md-icon>
          Back
        </md-outlined-button>
        <h1>Mock Details</h1>
      </div>

      <div class="card">
        <div class="detail-row">
          <span class="detail-label">Method</span>
          <span class="detail-value">
            <span class="${this._methodClass(this._mock.method)}">${this._mock.method}</span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Path Pattern</span>
          <span class="detail-value monospace">${this._mock.pathPattern}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">
            <span class="${this._statusClass(this._mock.status)}">${this._mock.status}</span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Proxy URL</span>
          <span class="detail-value monospace">${this._mock.proxyUrl || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Proxy Timeout</span>
          <span class="detail-value">${this._mock.proxyTimeoutMs ? `${this._mock.proxyTimeoutMs}ms` : '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Priority</span>
          <span class="detail-value">${this._mock.priority}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Created</span>
          <span class="detail-value">${new Date(this._mock.createdAt).toLocaleString()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Updated</span>
          <span class="detail-value">${new Date(this._mock.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      ${this._mock.promptExtra ? html`
        <div class="card">
          <div class="detail-row" style="flex-direction:column;align-items:stretch;">
            <span class="detail-label" style="margin-bottom:8px;">Prompt Extra</span>
            <div class="prompt-extra">${this._mock.promptExtra}</div>
          </div>
        </div>
      ` : ''}

      <div class="actions">
        <md-filled-button @click=${this._onGenerate} ?disabled=${this._generating}>
          ${this._generating ? html`<md-circular-progress indeterminate style="width:18px;height:18px;margin-right:8px;"></md-circular-progress>Generating...` : 'Generate Script'}
        </md-filled-button>
      </div>

      ${this._generateResult ? html`
        <div class="result-box ${this._generateResult.success ? 'result-success' : 'result-error'}">
          ${this._generateResult.message}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mock-detail': MockDetail;
  }
}
