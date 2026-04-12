import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '@material/web/button/filled-button';
import '@material/web/button/outlined-button';
import '@material/web/button/text-button';
import '@material/web/icon/icon';
import '@material/web/divider/divider';
import '@material/web/textfield/outlined-text-field';
import '@material/web/progress/circular-progress';
import type { SamplePair } from '../services/api.js';

/**
 * Sample Editor component — manages sample request/response pairs.
 * Uses Lit Element + Material Web Components.
 */
@customElement('sample-editor')
export class SampleEditor extends LitElement {
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

    .sample-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sample-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 16px;
      position: relative;
    }

    .sample-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .sample-meta {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 13px;
      color: #666;
    }

    .source-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: #dbeafe;
      color: #1e40af;
    }

    .source-manual {
      background: #f3f4f6;
      color: #4b5563;
    }

    .source-captured {
      background: #dcfce7;
      color: #166534;
    }

    .json-preview {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 150px;
      overflow-y: auto;
      margin-top: 8px;
    }

    .json-label {
      font-weight: 500;
      color: #666;
      font-size: 12px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog-content {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .form-field {
      margin-bottom: 16px;
    }

    .form-field textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      resize: vertical;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .result-box {
      margin-top: 16px;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
    }

    .result-success {
      background: #dcfce7;
      color: #166534;
    }

    .result-error {
      background: #fee2e2;
      color: #991b1b;
    }

    .count-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      background: #f3f4f6;
      color: #4b5563;
    }
  `;

  /** Optional: filter samples by endpoint ID */
  @property({ type: String })
  declare endpointId: string;

  @state()
  private declare _samples: SamplePair[];

  @state()
  private declare _loading: boolean;

  @state()
  private declare _error: string | null;

  @state()
  private declare _dialogOpen: boolean;

  @state()
  private declare _editingSample: SamplePair | null;

  @state()
  private declare _formData: {
    endpointId: string;
    source: string;
    request: string;
    response: string;
  };

  @state()
  private declare _saving: boolean;

  @state()
  private declare _result: { success: boolean; message: string } | null;

  constructor() {
    super();
    this.endpointId = '';
    this._samples = [];
    this._loading = true;
    this._error = null;
    this._dialogOpen = false;
    this._editingSample = null;
    this._formData = {
      endpointId: '',
      source: 'manual',
      request: '{}',
      response: '{}',
    };
    this._saving = false;
    this._result = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this._fetchSamples();
  }

  override willUpdate(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('endpointId')) {
      void this._fetchSamples();
    }
  }

  private async _fetchSamples(): Promise<void> {
    this._loading = true;
    this._error = null;
    this._result = null;
    try {
      const url = this.endpointId
        ? `/api/samples?endpointId=${this.endpointId}`
        : '/api/samples';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch samples: HTTP ${res.status}`);
      }
      this._samples = (await res.json()) as SamplePair[];
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load samples';
      this._samples = [];
    } finally {
      this._loading = false;
    }
  }

  private _onAddSample(): void {
    this._editingSample = null;
    this._formData = {
      endpointId: this.endpointId || '',
      source: 'manual',
      request: '{\n  \n}',
      response: '{\n  \n}',
    };
    this._dialogOpen = true;
  }

  private _onEditSample(sample: SamplePair): void {
    this._editingSample = sample;
    this._formData = {
      endpointId: sample.endpointId,
      source: sample.source,
      request: JSON.stringify(sample.request, null, 2),
      response: JSON.stringify(sample.response, null, 2),
    };
    this._dialogOpen = true;
  }

  private async _onDeleteSample(sample: SamplePair): Promise<void> {
    if (!confirm('Are you sure you want to delete this sample pair?')) {
      return;
    }

    try {
      const res = await fetch(`/api/samples/${sample.id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Failed to delete sample: HTTP ${res.status}`);
      }
      this._result = { success: true, message: 'Sample deleted successfully' };
      void this._fetchSamples();
    } catch (err) {
      this._result = {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to delete sample',
      };
    }
  }

  private _onDialogCancel(): void {
    this._dialogOpen = false;
  }

  private async _onDialogSave(): Promise<void> {
    this._saving = true;
    this._result = null;

    try {
      let requestJson: Record<string, unknown>;
      let responseJson: Record<string, unknown>;

      try {
        requestJson = JSON.parse(this._formData.request);
      } catch {
        throw new Error('Invalid JSON in request field');
      }

      try {
        responseJson = JSON.parse(this._formData.response);
      } catch {
        throw new Error('Invalid JSON in response field');
      }

      const data = {
        endpointId: this._formData.endpointId,
        source: this._formData.source,
        request: requestJson,
        response: responseJson,
      };

      let res: Response;
      if (this._editingSample) {
        res = await fetch(`/api/samples/${this._editingSample.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch('/api/samples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const body = await res.json() as Record<string, unknown>;
        throw new Error((body.error as string) || (body.message as string) || 'Failed to save sample');
      }

      this._result = {
        success: true,
        message: this._editingSample ? 'Sample updated successfully' : 'Sample created successfully',
      };
      this._dialogOpen = false;
      void this._fetchSamples();
    } catch (err) {
      this._result = {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to save sample',
      };
    } finally {
      this._saving = false;
    }
  }

  private _onFormChange(field: string, value: string): void {
    this._formData = { ...this._formData, [field]: value };
  }

  private _sourceClass(source: string): string {
    const base = 'source-badge';
    if (source === 'manual') return `${base} source-manual`;
    if (source === 'captured') return `${base} source-captured`;
    return base;
  }

  private _formatJson(json: Record<string, unknown>): string {
    try {
      return JSON.stringify(json, null, 2);
    } catch {
      return String(json);
    }
  }

  override render() {
    if (this._loading) {
      return html`
        <div class="header">
          <h1>Sample Pairs</h1>
          <span class="count-badge">Loading...</span>
        </div>
        <div style="display:flex;justify-content:center;padding:48px;">
          <md-circular-progress indeterminate></md-circular-progress>
        </div>
      `;
    }

    if (this._error) {
      return html`
        <div class="header">
          <h1>Sample Pairs</h1>
        </div>
        <div class="error">${this._error}</div>
        <div style="text-align:center;margin-top:24px;">
          <md-outlined-button @click=${() => void this._fetchSamples()}>Retry</md-outlined-button>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Sample Pairs</h1>
        <span class="count-badge">${this._samples.length} sample${this._samples.length !== 1 ? 's' : ''}</span>
        <md-filled-button @click=${this._onAddSample}>
          <md-icon slot="icon">add</md-icon>
          Add Sample
        </md-filled-button>
      </div>

      ${this._result ? html`
        <div class="result-box ${this._result.success ? 'result-success' : 'result-error'}">
          ${this._result.message}
        </div>
      ` : ''}

      ${this._samples.length === 0
        ? html`
            <div class="empty">
              <md-icon style="font-size:48px;width:48px;height:48px;">inbox</md-icon>
              <p>No sample pairs yet.</p>
              <md-outlined-button @click=${this._onAddSample}>Add your first sample</md-outlined-button>
            </div>
          `
        : html`
            <div class="sample-list">
              ${this._samples.map(
                (sample) => html`
                  <div class="sample-card">
                    <div class="sample-header">
                      <div class="sample-meta">
                        <span class="${this._sourceClass(sample.source)}">${sample.source}</span>
                        <span>Created: ${new Date(sample.createdAt).toLocaleString()}</span>
                      </div>
                      <div class="actions">
                        <md-outlined-button @click=${() => this._onEditSample(sample)}>
                          <md-icon slot="icon">edit</md-icon>
                          Edit
                        </md-outlined-button>
                        <md-text-button @click=${() => void this._onDeleteSample(sample)}>
                          <md-icon slot="icon">delete</md-icon>
                          Delete
                        </md-text-button>
                      </div>
                    </div>
                    <div>
                      <div class="json-label">Request</div>
                      <div class="json-preview">${this._formatJson(sample.request)}</div>
                    </div>
                    <div style="margin-top:12px;">
                      <div class="json-label">Response</div>
                      <div class="json-preview">${this._formatJson(sample.response)}</div>
                    </div>
                  </div>
                `,
              )}
            </div>
          `}

      ${this._dialogOpen ? html`
        <div class="dialog-overlay" @click=${(e: MouseEvent) => {
          if ((e.target as HTMLElement).classList.contains('dialog-overlay')) {
            this._onDialogCancel();
          }
        }}>
          <div class="dialog-content">
            <div class="dialog-header">
              <h2>${this._editingSample ? 'Edit Sample' : 'Add Sample'}</h2>
              <md-text-button @click=${this._onDialogCancel}>
                <md-icon slot="icon">close</md-icon>
              </md-text-button>
            </div>
            <div class="form-field">
              <md-outlined-textfield
                label="Endpoint ID"
                .value=${this._formData.endpointId}
                @input=${(e: Event) => this._onFormChange('endpointId', (e.target as HTMLInputElement).value)}
                ?disabled=${!!this.endpointId}
              ></md-outlined-textfield>
            </div>
            <div class="form-field">
              <label style="display:block;margin-bottom:4px;font-weight:500;font-size:14px;">Source</label>
              <select
                .value=${this._formData.source}
                @change=${(e: Event) => this._onFormChange('source', (e.target as HTMLSelectElement).value)}
                style="width:100%;padding:8px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;"
              >
                <option value="manual">Manual</option>
                <option value="captured">Captured</option>
              </select>
            </div>
            <div class="form-field">
              <label style="display:block;margin-bottom:4px;font-weight:500;font-size:14px;">Request (JSON)</label>
              <textarea
                .value=${this._formData.request}
                @input=${(e: Event) => this._onFormChange('request', (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="form-field">
              <label style="display:block;margin-bottom:4px;font-weight:500;font-size:14px;">Response (JSON)</label>
              <textarea
                .value=${this._formData.response}
                @input=${(e: Event) => this._onFormChange('response', (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="form-actions">
              <md-outlined-button @click=${this._onDialogCancel}>Cancel</md-outlined-button>
              <md-filled-button @click=${this._onDialogSave} ?disabled=${this._saving}>
                ${this._saving ? 'Saving...' : this._editingSample ? 'Update' : 'Create'}
              </md-filled-button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sample-editor': SampleEditor;
  }
}
