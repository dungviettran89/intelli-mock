// Intelli-Mock UI — Entry point
// Registers all web components and bootstraps the application.

import './components/mock-list.js';

// Re-export API client for consumers
export { createApiClient } from './services/api.js';
export type { ApiClient, MockEndpoint, SamplePair, MockScript } from './services/api.js';
