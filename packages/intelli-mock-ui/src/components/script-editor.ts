import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import '@material/web/button/filled-button';
import '@material/web/button/outlined-button';
import '@material/web/icon/icon';
import '@material/web/divider/divider';

/**
 * Script Editor component — CodeMirror 6-based editor for mock scripts.
 * Uses Lit Element + Material Web Components.
 */
@customElement('script-editor')
export class ScriptEditor extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 8px;
    }

    .editor-container {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }

    .editor-container.readonly {
      opacity: 0.9;
    }

    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      font-size: 12px;
      color: #666;
      background: #f9fafb;
      border-top: 1px solid #e0e0e0;
    }

    .result-box {
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: 6px;
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

    .readonly-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      background: #f3f4f6;
      color: #4b5563;
      text-transform: uppercase;
    }
  `;

  /** The code to display/edit. */
  @property({ type: String })
  declare code: string;

  /** Whether the editor is in read-only mode. */
  @property({ type: Boolean })
  declare readonly: boolean;

  /** Callback when the user saves the code. */
  @property({ attribute: false })
  declare onSave?: (code: string) => Promise<void>;

  @state()
  private declare _editorView: EditorView | null;

  @state()
  private declare _saving: boolean;

  @state()
  private declare _result: { success: boolean; message: string } | null;

  @query('.editor-container')
  private declare _editorContainer: HTMLElement;

  constructor() {
    super();
    this.code = '';
    this.readonly = false;
    this._editorView = null;
    this._saving = false;
    this._result = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
  }

  override firstUpdated(): void {
    this._initEditor();
  }

  override willUpdate(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('code') && this._editorView) {
      this._updateEditorContent();
    }
    if (changedProperties.has('readonly') && this._editorView) {
      this._updateReadonlyState();
    }
  }

  private _initEditor(): void {
    if (!this._editorContainer) return;

    // Clear previous editor
    if (this._editorView) {
      this._editorView.destroy();
    }

    const extensions = [
      basicSetup,
      javascript(),
      EditorView.lineWrapping,
    ];

    if (!this.readonly) {
      extensions.push(oneDark);
    }

    this._editorView = new EditorView({
      doc: this.code,
      extensions: [
        ...extensions,
        EditorView.editable.of(!this.readonly),
      ],
      parent: this._editorContainer,
    });
  }

  private _updateEditorContent(): void {
    if (!this._editorView) return;
    const currentDoc = this._editorView.state.doc.toString();
    if (currentDoc !== this.code) {
      this._editorView.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: this.code,
        },
      });
    }
  }

  private _updateReadonlyState(): void {
    if (!this._editorView) return;
    // Destroy and recreate editor with new readonly state
    this._initEditor();
  }

  private _getCode(): string {
    return this._editorView?.state.doc.toString() ?? '';
  }

  private async _onSave(): Promise<void> {
    if (!this.onSave || this.readonly) return;

    this._saving = true;
    this._result = null;
    try {
      const code = this._getCode();
      await this.onSave(code);
      this._result = { success: true, message: 'Script saved successfully' };
    } catch (err) {
      this._result = {
        success: false,
        message: err instanceof Error ? err.message : 'Save failed',
      };
    } finally {
      this._saving = false;
    }
  }

  private _onFormat(): void {
    // Basic formatting — just a placeholder for now
    // In a real implementation, you'd use a JS formatter like Prettier
    this._result = { success: true, message: 'Format not implemented yet' };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._editorView) {
      this._editorView.destroy();
      this._editorView = null;
    }
  }

  override render() {
    return html`
      <div class="toolbar">
        ${this.readonly
          ? html`<span class="readonly-badge">Read Only</span>`
          : html`
              <md-outlined-button @click=${this._onSave} ?disabled=${this._saving}>
                <md-icon slot="icon">save</md-icon>
                ${this._saving ? 'Saving...' : 'Save'}
              </md-outlined-button>
              <md-outlined-button @click=${this._onFormat}>
                <md-icon slot="icon">format_align_left</md-icon>
                Format
              </md-outlined-button>
            `}
      </div>

      <div class="editor-container ${this.readonly ? 'readonly' : ''}"></div>

      <div class="status-bar">
        <span>JavaScript</span>
        <span>${this._getCode().length} chars</span>
      </div>

      ${this._result
        ? html`
            <div class="result-box ${this._result.success ? 'result-success' : 'result-error'}">
              ${this._result.message}
            </div>
          `
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'script-editor': ScriptEditor;
  }
}
