export interface ExternalApiHealthCheck {
  reachable: boolean;
  responseValid: boolean;
  responseTime: number;
  error?: string;
}

const DEFAULT_BASE_URL = 'https://jsonplaceholder.typicode.com';
const DEFAULT_TIMEOUT = 10000;

/**
 * Checks if the external test API (JSONPlaceholder) is accessible.
 * Sends a GET request to /posts/1 and validates the response structure.
 */
export async function checkExternalApiHealth(options: {
  baseUrl?: string;
  timeout?: number;
} = {}): Promise<ExternalApiHealthCheck> {
  const baseUrl = options.baseUrl || process.env.EXTERNAL_API_BASE || DEFAULT_BASE_URL;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  const result: ExternalApiHealthCheck = {
    reachable: false,
    responseValid: false,
    responseTime: 0,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/posts/1`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    result.responseTime = Date.now() - startTime;

    if (!response.ok) {
      result.reachable = true;
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    result.reachable = true;

    const data: Record<string, unknown> = await response.json();

    // Validate expected structure
    const hasUserId = 'userId' in data;
    const hasId = 'id' in data;
    const hasTitle = 'title' in data;
    const hasBody = 'body' in data;

    if (hasUserId && hasId && hasTitle && hasBody) {
      result.responseValid = true;
    } else {
      result.error = `Unexpected response structure: ${JSON.stringify(data).slice(0, 100)}`;
    }
  } catch (error: any) {
    if (error.message?.includes('abort') || error.message?.includes('timeout')) {
      result.error = `Request timed out after ${timeout}ms`;
    } else if (error.message?.includes('fetch')) {
      result.error = 'Cannot reach JSONPlaceholder. Check internet connection.';
    } else {
      result.error = error.message || 'Unknown error';
    }
  }

  return result;
}

/**
 * Returns a human-readable message for external API health.
 */
export function getExternalApiMessage(health: ExternalApiHealthCheck): string {
  if (health.reachable && health.responseValid) {
    return `✅ JSONPlaceholder reachable (${health.responseTime}ms)`;
  }

  if (!health.reachable) {
    return `❌ ${health.error || 'Cannot reach JSONPlaceholder'}`;
  }

  return `⚠️ JSONPlaceholder reachable but invalid response: ${health.error}`;
}
