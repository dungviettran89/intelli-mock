import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { TrafficService } from '../../modules/mock/traffic.service.js';
import { TrafficSource, TrafficRequest, TrafficResponse } from '../../entities/traffic-log.entity.js';

/**
 * Default retention period in days for traffic logs.
 */
export const DEFAULT_RETENTION_DAYS = 30;

/**
 * TrafficLogger provides a high-level interface for logging traffic
 * from Express request/response cycles. It normalizes Express objects
 * into the TrafficRequest/TrafficResponse format expected by TrafficService.
 */
@injectable()
export class TrafficLogger {
  constructor(
    @inject(TrafficService) private trafficService: TrafficService,
  ) {}

  /**
   * Logs a traffic entry from Express request and response objects.
   *
   * @param params - The logging parameters
   * @param params.req - Express Request object
   * @param params.res - Express Response object (must have statusCode set)
   * @param params.tenantId - The tenant ID
   * @param params.endpointId - The matched endpoint ID (nullable)
   * @param params.route - The matched route pattern
   * @param params.source - The traffic source (mock, proxy, fallback, auto)
   * @param params.latency - Optional response latency in ms
   * @param params.responseBody - The response body that was sent
   * @returns The created TrafficLog entity
   */
  async logFromExpress(params: {
    req: Request;
    res: Response;
    tenantId: string | null;
    endpointId: string | null;
    route: string;
    source: TrafficSource;
    latency?: number;
    responseBody?: any;
  }): Promise<ReturnType<typeof TrafficService.prototype.logTraffic>> {
    const { req, res, tenantId, endpointId, route, source, latency, responseBody } = params;

    const trafficReq: TrafficRequest = {
      method: req.method,
      path: req.originalUrl || req.url,
      params: req.params,
      query: req.query as Record<string, any>,
      headers: req.headers as Record<string, string>,
      body: req.body,
    };

    const trafficRes: TrafficResponse = {
      status: res.statusCode,
      headers: Object.fromEntries(
        Object.entries(res.getHeaders()).map(([k, v]) => [k, String(v)]),
      ),
      body: responseBody ?? null,
      latency,
    };

    return this.trafficService.logTraffic({
      tenantId,
      endpointId,
      route,
      method: req.method,
      path: req.originalUrl || req.url,
      request: trafficReq,
      response: trafficRes,
      source,
    });
  }

  /**
   * Directly logs a traffic entry using pre-formatted request/response objects.
   * This is useful when the caller has already normalized the data.
   */
  async logTraffic(params: {
    tenantId: string | null;
    endpointId: string | null;
    route: string;
    method: string;
    path: string;
    request: TrafficRequest;
    response: TrafficResponse;
    source: TrafficSource;
  }): ReturnType<typeof TrafficService.prototype.logTraffic> {
    return this.trafficService.logTraffic(params);
  }
}
