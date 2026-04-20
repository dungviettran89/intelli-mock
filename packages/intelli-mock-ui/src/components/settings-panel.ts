import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/textfield/outlined-text-field';
import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import '@material/web/button/filled-button';
import '@material/web/button/outlined-button';
import '@material/web/slider/slider';
import '@material/web/icon/icon';
import '@material/web/divider/divider';

/**
 * Settings Panel component — manages tenant, AI, and proxy settings.
 * Based on docs/mockups/settings.html
 */
@customElement('settings-panel')
export class SettingsPanel extends LitElement {
  static override styles = css`
    :host {
      display: block;
      max-width: 1152px; /* 6xl */
      margin: 0 auto;
      padding: 48px 32px;
      font-family: 'Inter', system-ui, sans-serif;
      color: #1b1b1b;
    }

    header {
      margin-bottom: 48px;
    }

    h2 {
      font-size: 48px;
      font-weight: 900;
      letter-spacing: -0.05em;
      margin: 0 0 8px 0;
    }

    .subtitle {
      color: #5b403d;
      font-size: 16px;
    }

    .bento-grid {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: 24px;
      margin-bottom: 48px;
    }

    @media (min-width: 768px) {
      .bento-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .tenant-config {
        grid-column: span 2;
      }
    }

    .card {
      background: #ffffff;
      padding: 32px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .card-dark {
      background: #303030;
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }

    .card-dark::after {
      content: '';
      position: absolute;
      top: -16px;
      right: -16px;
      width: 128px;
      height: 128px;
      background: rgba(211, 47, 47, 0.2);
      border-radius: 50%;
      filter: blur(32px);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .card-header md-icon {
      color: #d32f2f;
    }

    .card-dark .card-header md-icon {
      color: #ffdad6;
    }

    .card-header h3 {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 14px;
      margin: 0;
      opacity: 0.7;
    }

    .card-dark .card-header h3 {
      opacity: 0.7;
      color: #ffffff;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }

    .label-mini {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #5b403d;
      display: block;
      margin-bottom: 4px;
    }

    .card-dark .label-mini {
      color: rgba(255, 255, 255, 0.5);
    }

    .value-large {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
    }

    .metrics-value {
      font-size: 24px;
      font-weight: 900;
      margin: 16px 0 0 0;
    }

    .metrics-unit {
      font-size: 12px;
      font-weight: 400;
      opacity: 0.5;
    }

    .progress-container {
      margin-bottom: 16px;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .progress-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #d32f2f;
    }

    .section-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 48px;
      margin-bottom: 80px;
    }

    @media (min-width: 1024px) {
      .section-grid {
        grid-template-columns: 1fr 1fr;
      }
      .span-full {
        grid-column: 1 / -1;
      }
    }

    .section-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .icon-container {
      width: 40px;
      height: 40px;
      background: rgba(211, 47, 47, 0.1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-container md-icon {
      color: #d32f2f;
    }

    .section-title-group h3 {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
    }

    .section-title-group p {
      font-size: 14px;
      color: #5b403d;
      margin: 0;
    }

    .form-container {
      background: #f3f3f3;
      padding: 24px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .proxy-defaults {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.05);
      padding: 32px;
      border-radius: 12px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 32px;
    }

    @media (min-width: 768px) {
      .proxy-defaults {
        grid-template-columns: 1fr 1fr;
      }
    }

    .strategy-group {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .strategy-item {
      display: flex;
      gap: 16px;
    }

    .radio-sim {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid #d32f2f;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .radio-sim-inner {
      width: 8px;
      height: 8px;
      background: #d32f2f;
      border-radius: 50%;
    }

    .strategy-text h4 {
      font-size: 14px;
      font-weight: 700;
      margin: 0;
    }

    .strategy-text p {
      font-size: 12px;
      color: #5b403d;
      margin: 4px 0 0 0;
    }

    .proxy-fields {
      border-left: 1px solid rgba(0, 0, 0, 0.05);
      padding-left: 32px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .danger-zone {
      margin-top: 80px;
      padding-top: 48px;
      border-top: 1px solid rgba(186, 26, 26, 0.2);
    }

    .danger-card {
      background: rgba(255, 218, 214, 0.2);
      border: 1px solid rgba(186, 26, 26, 0.1);
      padding: 32px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 24px;
    }

    @media (min-width: 768px) {
      .danger-card {
        flex-direction: row;
        align-items: center;
      }
    }

    .danger-text h3 {
      color: #ba1a1a;
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .danger-text p {
      font-size: 14px;
      color: #5b403d;
      margin: 4px 0 0 0;
    }

    md-filled-button {
      --md-filled-button-container-color: #d32f2f;
      --md-filled-button-label-text-color: #ffffff;
    }

    .danger-card md-filled-button {
      --md-filled-button-container-color: #ba1a1a;
    }

    md-outlined-text-field, md-outlined-select {
      --md-outlined-text-field-container-color: #ffffff;
      --md-outlined-text-field-focus-outline-color: #d32f2f;
      --md-outlined-text-field-focus-label-text-color: #d32f2f;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .slider-row span {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 14px;
      width: 48px;
      text-align: right;
    }
  `;

  @state() private declare tenantSlug: string;
  @state() private declare tenantName: string;
  @state() private declare aiEndpoint: string;
  @state() private declare aiModel: string;
  @state() private declare aiTemperature: number;
  @state() private declare jwtIssuer: string;
  @state() private declare jwtAlgorithm: string;
  @state() private declare globalTimeout: number;
  @state() private declare defaultCacheTtl: string;

  constructor() {
    super();
    this.tenantSlug = 'intelli-prod-01';
    this.tenantName = 'Global Architecture Lab';
    this.aiEndpoint = 'https://api.openai.com/v1';
    this.aiModel = 'gpt-4-turbo';
    this.aiTemperature = 0.7;
    this.jwtIssuer = 'https://auth.intelli-mock.io';
    this.jwtAlgorithm = 'RS256';
    this.globalTimeout = 3500;
    this.defaultCacheTtl = '3600s';
  }

  override render() {
    return html`
      <section class="bento-grid">
        <div class="card tenant-config">
          <div>
            <div class="card-header">
              <md-icon>domain</md-icon>
              <h3>Tenant Configuration</h3>
            </div>
            <div class="grid-2">
              <div>
                <span class="label-mini">View Slug</span>
                <p class="value-large">${this.tenantSlug}</p>
              </div>
              <div>
                <span class="label-mini">Organization Name</span>
                <p class="value-large">${this.tenantName}</p>
              </div>
            </div>
          </div>
          <div style="margin-top: 32px; pt: 24px; border-top: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: flex-end;">
            <md-outlined-button style="margin-top: 24px;">Edit Details</md-outlined-button>
          </div>
        </div>

        <div class="card card-dark">
          <div>
            <div class="card-header">
              <md-icon>speed</md-icon>
              <h3>Usage Metrics</h3>
            </div>
            <div class="progress-container">
              <div class="progress-info">
                <span>Monthly Quota</span>
                <span>82%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: 82%"></div>
              </div>
            </div>
            <p class="metrics-value">2.4M <span class="metrics-unit">Requests</span></p>
          </div>
          <md-filled-button style="margin-top: 24px;">Upgrade Plan</md-filled-button>
        </div>
      </section>

      <div class="section-grid">
        <!-- AI Config -->
        <div class="space-y">
          <div class="section-title-group">
            <div class="icon-container">
              <md-icon>psychology</md-icon>
            </div>
            <div>
              <h3>AI Orchestration</h3>
              <p>LLM endpoint and model parameters.</p>
            </div>
          </div>
          <div class="form-container">
            <div class="space-y">
              <label class="label-mini">Provider Endpoint</label>
              <input
                type="text"
                style="width: 100%; padding: 12px; border-radius: 4px; border: 1px solid #ccc;"
                .value="${this.aiEndpoint}"
                @input="${(e: any) => (this.aiEndpoint = e.target.value)}"
              />
            </div>
            <div class="form-row">
              <div class="space-y">
                <label class="label-mini">Model ID</label>
                <select
                  style="width: 100%; padding: 12px; border-radius: 4px; border: 1px solid #ccc;"
                  .value="${this.aiModel}"
                  @change="${(e: any) => (this.aiModel = e.target.value)}"
                >
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  <option value="ollama-llama3">ollama-llama3</option>
                </select>
              </div>
              <div class="space-y">
                <label class="label-mini">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  style="width: 100%; padding: 12px; border-radius: 4px; border: 1px solid #ccc;"
                  .value="${this.aiTemperature.toString()}"
                  @input="${(e: any) => (this.aiTemperature = parseFloat(e.target.value))}"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Auth Config -->
        <div class="space-y">
          <div class="section-title-group">
            <div class="icon-container">
              <md-icon>key</md-icon>
            </div>
            <div>
              <h3>Security & Auth</h3>
              <p>JWT validation and signature protocols.</p>
            </div>
          </div>
          <div class="form-container">
            <div class="space-y">
              <label class="label-mini">JWT Issuer (iss)</label>
              <input
                type="text"
                style="width: 100%; padding: 12px; border-radius: 4px; border: 1px solid #ccc;"
                .value="${this.jwtIssuer}"
                @input="${(e: any) => (this.jwtIssuer = e.target.value)}"
              />
            </div>
            <div class="space-y">
              <span class="label-mini" style="margin-bottom: 8px;">Signing Algorithm</span>
              <div class="form-row">
                <button
                  style="padding: 8px; border: 1px solid ${this.jwtAlgorithm === 'RS256' ? '#d32f2f' : '#ccc'}; border-radius: 4px; background: ${this.jwtAlgorithm === 'RS256' ? '#fff2f0' : '#fff'};"
                  @click="${() => (this.jwtAlgorithm = 'RS256')}"
                >RS256</button>
                <button
                  style="padding: 8px; border: 1px solid ${this.jwtAlgorithm === 'HS256' ? '#d32f2f' : '#ccc'}; border-radius: 4px; background: ${this.jwtAlgorithm === 'HS256' ? '#fff2f0' : '#fff'};"
                  @click="${() => (this.jwtAlgorithm = 'HS256')}"
                >HS256</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Proxy Config -->
        <div class="span-full">
          <div class="section-title-group">
            <div class="icon-container">
              <md-icon>router</md-icon>
            </div>
            <div>
              <h3>Proxy Engine Defaults</h3>
              <p>Global routing behavior for unhandled endpoints.</p>
            </div>
          </div>
          <div class="proxy-defaults">
            <div class="strategy-group">
              <div class="strategy-item">
                <div class="radio-sim"><div class="radio-sim-inner"></div></div>
                <div class="strategy-text">
                  <h4>Fallback Strategy</h4>
                  <p>If no mock matches, return a 404 response immediately.</p>
                </div>
              </div>
              <div class="strategy-item" style="opacity: 0.5;">
                <div class="radio-sim" style="border-color: #8f6f6c;"><div class="radio-sim-inner" style="background: transparent;"></div></div>
                <div class="strategy-text">
                  <h4>Transparent Proxy</h4>
                  <p>Forward unmatched requests to the actual production backend.</p>
                </div>
              </div>
            </div>
            <div class="proxy-fields">
              <div class="space-y">
                <span class="label-mini">Global Timeout (ms)</span>
                <div class="slider-row">
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    style="flex: 1; accent-color: #d32f2f;"
                    .value="${this.globalTimeout}"
                    @input="${(e: any) => (this.globalTimeout = parseInt(e.target.value))}"
                  />
                  <span>${this.globalTimeout}</span>
                </div>
              </div>
              <div class="space-y">
                <label class="label-mini">Default Cache TTL</label>
                <input
                  type="text"
                  style="width: 100%; padding: 12px; border-radius: 4px; border: 1px solid #ccc;"
                  .value="${this.defaultCacheTtl}"
                  @input="${(e: any) => (this.defaultCacheTtl = e.target.value)}"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section class="danger-zone">
        <h3 style="color: #ba1a1a; font-family: 'Space Grotesk', sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 14px; margin-bottom: 24px;">Danger Zone</h3>
        <div class="danger-card">
          <div class="danger-text">
            <h3><md-icon>warning</md-icon> Critical: Purge Environment</h3>
            <p>Permanently delete all mock definitions and traffic history for this tenant.</p>
          </div>
          <md-filled-button>Purge All Data</md-filled-button>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-panel': SettingsPanel;
  }
}
