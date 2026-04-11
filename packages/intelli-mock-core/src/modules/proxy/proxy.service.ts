import { injectable, inject } from 'tsyringe';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { TrafficService } from '../mock/traffic.service';
import { TrafficSource, TrafficRequest, TrafficResponse } from '../../entities/traffic-log.entity';

export interface ProxyRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface ProxyResult {
  success: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: any;
  error?: {
    message: string;
    code?: string;
  };
  latency?: number;
}

/**
 * ProxyService handles HTTP forwarding to real APIs.
 * Forwards requests, captures traffic, and returns responses.
 */
@injectable()
export class ProxyService {
  private defaultTimeout: number;

  constructor(@inject(TrafficService) private trafficService: TrafficService) {
    this.defaultTimeout = parseInt(process.env.PROXY_TIMEOUT || '30000', 10);
  }

  /**
   * Forwards a request to a target URL and returns the response.
   * Logs the request/response pair to TrafficLog.
   */
  async forwardRequest(
    targetUrl: string,
    options: ProxyRequestOptions,
    tenantId: string | null,
    endpointId: string | null,
    route: string,
    originalPath: string,
  ): Promise<ProxyResult> {
    const startTime = Date.now();
    const method = options.method || 'GET';

    const requestLog: TrafficRequest = {
      method,
      path: originalPath,
      headers: options.headers,
      body: options.body,
    };

    try {
      const result = await this.executeHttpRequest(targetUrl, options);

      const latency = Date.now() - startTime;
      const responseLog: TrafficResponse = {
        status: result.status,
        headers: result.headers,
        body: result.body,
        latency,
      };

      // Log successful proxy request
      await this.logTrafficSafe({
        tenantId,
        endpointId,
        route,
        method,
        path: originalPath,
        request: requestLog,
        response: responseLog,
        source: TrafficSource.PROXY,
      });

      return {
        success: true,
        status: result.status,
        headers: result.headers,
        body: result.body,
        latency,
      };
    } catch (err) {
      const latency = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = err instanceof Error && 'code' in err ? (err as any).code : undefined;

      const responseLog: TrafficResponse = {
        status: 502,
        body: {
          error: 'Proxy error',
          message: errorMessage,
          code: errorCode,
        },
        latency,
      };

      // Log failed proxy request
      await this.logTrafficSafe({
        tenantId,
        endpointId,
        route,
        method,
        path: originalPath,
        request: requestLog,
        response: responseLog,
        source: TrafficSource.PROXY,
      });

      return {
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
        },
        latency,
      };
    }
  }

  /**
   * Executes the actual HTTP request using Node's built-in http/https modules.
   */
  private executeHttpRequest(
    targetUrl: string,
    options: ProxyRequestOptions,
  ): Promise<{ status: number; headers: Record<string, string>; body: any }> {
    return new Promise((resolve, reject) => {
      const url = new URL(targetUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions: http.RequestOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || this.defaultTimeout,
      };

      const req = client.request(targetUrl, requestOptions, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = this.parseResponseBody(res.headers['content-type'], Buffer.concat(chunks));

          // Convert headers to plain object with lowercase keys
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            headers[key] = Array.isArray(value) ? value.join(', ') : (value || '');
          }

          resolve({
            status: res.statusCode || 500,
            headers,
            body,
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Proxy request timed out after ${options.timeout || this.defaultTimeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      // Write body if present
      if (options.body !== undefined && options.body !== null) {
        const bodyStr =
          typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        req.write(bodyStr);
      }

      req.end();
    });
  }

  /**
   * Parses response body based on content-type header.
   */
  private parseResponseBody(contentType: string | undefined, buffer: Buffer): any {
    const bodyStr = buffer.toString('utf-8');

    if (contentType && contentType.includes('application/json')) {
      try {
        return JSON.parse(bodyStr);
      } catch {
        // If it looks like JSON but fails, return as string
        return bodyStr;
      }
    }

    // Try to parse as JSON anyway
    try {
      return JSON.parse(bodyStr);
    } catch {
      return bodyStr;
    }
  }

  /**
   * Logs traffic without throwing errors.
   * Ensures proxy failures don't prevent response delivery.
   */
  private async logTrafficSafe(params: {
    tenantId: string | null;
    endpointId: string | null;
    route: string;
    method: string;
    path: string;
    request: TrafficRequest;
    response: TrafficResponse;
    source: TrafficSource;
  }): Promise<void> {
    try {
      await this.trafficService.logTraffic(params);
    } catch (logErr) {
      // Don't fail the proxy response if logging fails
      console.error('[ProxyService] Failed to log traffic:', logErr);
    }
  }
}
