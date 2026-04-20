// Intelli-Mock UI — Entry point
// Registers all web components and bootstraps the application.

import './components/app-shell.js';
import './components/mock-list.js';
import './components/mock-detail.js';
import './components/script-editor.js';
import './components/sample-editor.js';
import './components/settings-panel.js';

// Re-export API client for consumers
export { createApiClient } from './services/api.js';
export type { ApiClient, MockEndpoint, SamplePair, MockScript } from './services/api.js';
