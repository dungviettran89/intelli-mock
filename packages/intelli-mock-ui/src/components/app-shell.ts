import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@material/web/icon/icon';

/**
 * App Shell component — provides the global layout and navigation.
 * Based on docs/UI.md and docs/mockups/mock-endpoints.html
 */
@customElement('app-shell')
export class AppShell extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
    }

    aside {
      width: 256px;
      background: #303030;
      display: flex;
      flex-direction: column;
      z-index: 50;
      flex-shrink: 0;
    }

    .brand {
      padding: 32px;
      padding-bottom: 48px;
    }

    .brand h1 {
      font-size: 24px;
      font-weight: 900;
      color: #d32f2f;
      margin: 0;
      letter-spacing: -0.05em;
      font-family: 'Inter', sans-serif;
    }

    .brand p {
      font-family: 'Space Grotesk', sans-serif;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.5);
      margin: 4px 0 0 0;
    }

    nav {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      padding: 12px 32px;
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      font-family: 'Space Grotesk', sans-serif;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      transition: all 0.2s ease;
      border-left: 4px solid transparent;
      cursor: pointer;
    }

    .nav-link:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }

    .nav-link.active {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
      border-left-color: #d32f2f;
    }

    .nav-link md-icon {
      margin-right: 16px;
      --md-icon-size: 20px;
    }

    .sidebar-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding: 16px 0 32px 0;
    }

    .footer-link {
      display: flex;
      align-items: center;
      padding: 8px 32px;
      color: rgba(255, 255, 255, 0.4);
      font-family: 'Space Grotesk', sans-serif;
      text-transform: uppercase;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-decoration: none;
      transition: color 0.2s;
    }

    .footer-link:hover {
      color: #ffffff;
    }

    .footer-link md-icon {
      margin-right: 16px;
      --md-icon-size: 16px;
    }

    main {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      background: #f9f9f9;
      overflow: hidden;
    }

    header {
      height: 64px;
      background: rgba(249, 249, 249, 0.85);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 40;
      flex-shrink: 0;
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .breadcrumb-root {
      color: rgba(0, 0, 0, 0.4);
    }

    .breadcrumb-separator {
      color: rgba(0, 0, 0, 0.1);
      font-size: 10px;
    }

    .breadcrumb-current {
      color: #1b1b1b;
      border-bottom: 2px solid #d32f2f;
      padding-bottom: 4px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .tenant-badge {
      background: #eeeeee;
      padding: 6px 12px;
      border-radius: 4px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-indicator {
      width: 6px;
      height: 6px;
      background: #16a34a;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
    }

    .profile-chip {
      width: 32px;
      height: 32px;
      background: #303030;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      overflow: hidden;
    }

    .content {
      flex-grow: 1;
      overflow-y: auto;
      padding-bottom: 64px;
    }

    .content-footer {
      padding: 32px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      display: flex;
      align-items: center;
      gap: 32px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(0, 0, 0, 0.3);
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .primary-dot { background: #d32f2f; }
    .secondary-dot { background: #2563eb; }
    .tertiary-dot { background: #16a34a; }
  `;

  @state()
  private declare _currentView: string;

  constructor() {
    super();
    this._currentView = 'mocks';
  }

  private _setView(view: string) {
    this._currentView = view;
  }

  private _renderCurrentView() {
    switch (this._currentView) {
      case 'mocks':
        return html`<mock-list></mock-list>`;
      case 'settings':
        return html`<settings-panel></settings-panel>`;
      case 'traffic':
        return html`
          <div style="padding: 48px; text-align: center;">
            <md-icon style="font-size: 64px; width: 64px; height: 64px; opacity: 0.2;">analytics</md-icon>
            <h2 style="font-family: 'Space Grotesk'; text-transform: uppercase; margin-top: 24px;">Traffic Log Viewer</h2>
            <p style="color: #666;">This component is under development.</p>
          </div>
        `;
      default:
        return html`<mock-list></mock-list>`;
    }
  }

  private _getViewTitle() {
    switch (this._currentView) {
      case 'mocks': return 'Endpoint Explorer';
      case 'settings': return 'System Settings';
      case 'traffic': return 'Traffic Analysis';
      default: return 'Explorer';
    }
  }

  override render() {
    return html`
      <aside>
        <div class="brand">
          <h1>Intelli-Mock</h1>
          <p>Technical Editorial</p>
        </div>
        <nav>
          <a class="nav-link ${this._currentView === 'mocks' ? 'active' : ''}" @click="${() => this._setView('mocks')}">
            <md-icon>api</md-icon>
            Mocks
          </a>
          <a class="nav-link ${this._currentView === 'traffic' ? 'active' : ''}" @click="${() => this._setView('traffic')}">
            <md-icon>analytics</md-icon>
            Traffic
          </a>
          <a class="nav-link ${this._currentView === 'settings' ? 'active' : ''}" @click="${() => this._setView('settings')}">
            <md-icon>settings</md-icon>
            Settings
          </a>
        </nav>
        <div class="sidebar-footer">
          <a href="#" class="footer-link">
            <md-icon>help_outline</md-icon>
            Help
          </a>
          <a href="#" class="footer-link">
            <md-icon>description</md-icon>
            Documentation
          </a>
        </div>
      </aside>

      <main>
        <header>
          <div class="breadcrumbs">
            <span class="breadcrumb-root">${this._currentView.toUpperCase()}</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-current">${this._getViewTitle()}</span>
          </div>
          <div class="header-actions">
            <div class="tenant-badge">
              <span class="status-indicator"></span>
              Tenant: Default
            </div>
            <div class="profile-chip">AD</div>
          </div>
        </header>

        <div class="content">
          ${this._renderCurrentView()}
        </div>

        <footer class="content-footer">
          <div class="stat-item">
            <span class="stat-dot primary-dot"></span>
            Total Mocks: 12
          </div>
          <div class="stat-item">
            <span class="stat-dot secondary-dot"></span>
            Hits (24h): 8.4k
          </div>
          <div class="stat-item">
            <span class="stat-dot tertiary-dot"></span>
            Uptime: 100%
          </div>
          <div style="margin-left: auto; display: flex; gap: 24px;">
            <a href="#" style="color: inherit; text-decoration: none;">API Docs</a>
            <a href="#" style="color: inherit; text-decoration: none;">System Status</a>
          </div>
        </footer>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-shell': AppShell;
  }
}
