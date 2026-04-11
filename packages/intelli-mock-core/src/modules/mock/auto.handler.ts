import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { RouteMatcher } from '../../core/matching/route-matcher';
import { MockService } from './mock.service';
import { TrafficService } from './traffic.service';
import { TrafficSource } from '../../entities/traffic-log.entity';
import { MockScript } from '../../entities/mock-script.entity';
import { getDataSource } from '../../database/data-source';
import { Repository } from 'typeorm';
import { ScriptRunner } from '../script/script.runner';
import { ProxyService } from '../proxy/proxy.service';

/**
 * AutoHandler processes runtime auto-endpoint requests at /_it/auto/*
 *
 * Pipeline:
 * 1. Extract path from request URL
 * 2. Find longest-matching MockEndpoint via RouteMatcher
 * 3. Check if proxy_url is configured on endpoint
 * 4. If yes: forward request via ProxyService
 *    - Success → log traffic → return response
 *    - Failure → log error → fall back to mock execution
 * 5. If no proxy_url: fall back to mock execution
 * 6. Check for active MockScript
 * 7. Return 502 if no script, or execute script in vm2 sandbox
 * 8. Log request/response to TrafficLog
 */
@injectable()
export class AutoHandler {
  private scriptRepo: Repository<MockScript>;

  constructor(
    @inject(RouteMatcher) private routeMatcher: RouteMatcher,
    @inject(MockService) private mockService: MockService,
    @inject(TrafficService) private trafficService: TrafficService,
    @inject(ScriptRunner) private scriptRunner: ScriptRunner,
    @inject(ProxyService) private proxyService: ProxyService,
  ) {
    const ds = getDataSource();
    this.scriptRepo = ds.getRepository(MockScript);
  }

  /**
   * Handles all requests to /_it/auto/*
   * Tries proxy first, falls back to mock if unavailable.
   */
  async handle(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const tenantId = req.tenant?.id ?? null;
    const method = req.method.toUpperCase();

    // Extract path from /_it/auto/** by stripping the prefix
    const fullPath = req.path;
    const autoPath = fullPath.replace(/^\/_it\/auto/, '') || '/';

    // Build request object for logging
    const requestLog = {
      method,
      path: autoPath,
      params: req.params,
      query: req.query,
      headers: req.headers as Record<string, string>,
      body: req.body,
    };

    try {
      // Step 1: Find matching endpoint
      const candidates = await this.mockService.findCandidates(tenantId || '', method as any);
      const match = this.routeMatcher.match(candidates, method, autoPath);

      if (!match) {
        // No matching endpoint found
        const responseLog = {
          status: 404,
          body: { error: 'Auto endpoint not found', path: autoPath },
        };

        await this.logAndRespond(
          req, res, tenantId, null, autoPath, method,
          requestLog, responseLog, startTime, TrafficSource.AUTO
        );
        return;
      }

      const endpoint = match.endpoint;

      // Step 2: Check if proxy_url is configured
      if (endpoint.proxyUrl) {
        // Try to forward to real API
        const proxyResult = await this.proxyService.forwardRequest(
          endpoint.proxyUrl,
          {
            method,
            headers: req.headers as Record<string, string>,
            body: req.body,
          },
          tenantId,
          endpoint.id,
          autoPath,
          autoPath,
        );

        if (proxyResult.success && proxyResult.status !== undefined) {
          // Proxy succeeded
          const responseLog = {
            status: proxyResult.status,
            headers: proxyResult.headers,
            body: proxyResult.body,
          };

          await this.logAndRespond(
            req, res, tenantId, endpoint.id, autoPath, method,
            requestLog, responseLog, startTime, TrafficSource.AUTO
          );
          return;
        }

        // Proxy failed - log the error and fall back to mock
        console.error('[AutoHandler] Proxy failed, falling back to mock:', proxyResult.error);
      }

      // Step 3: Fall back to mock execution
      await this.executeMock(req, res, tenantId, endpoint, autoPath, method, requestLog, startTime);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const responseLog = {
        status: 500,
        body: { error: 'Internal server error', message: errorMessage },
      };

      await this.logAndRespond(
        req, res, tenantId, null, autoPath, method,
        requestLog, responseLog, startTime, TrafficSource.AUTO
      );
    }
  }

  /**
   * Executes mock script as fallback when proxy is not configured or fails.
   */
  private async executeMock(
    req: Request,
    res: Response,
    tenantId: string | null,
    endpoint: any,
    autoPath: string,
    method: string,
    requestLog: any,
    startTime: number,
  ): Promise<void> {
    // Check for active script
    const activeScript = await this.scriptRepo.findOne({
      where: { endpointId: endpoint.id, isActive: true },
    });

    if (!activeScript) {
      // No active script - return 502
      const sampleCount = endpoint.samplePairs?.length ?? 0;
      const responseLog = {
        status: 502,
        body: {
          error: 'Mock unavailable',
          message: sampleCount > 0
            ? `Need ${5 - sampleCount} more sample(s) to generate script`
            : 'Need 5+ samples to generate script',
          currentSamples: sampleCount,
          minimumRequired: 5,
        },
      };

      await this.logAndRespond(
        req, res, tenantId, endpoint.id, autoPath, method,
        requestLog, responseLog, startTime, TrafficSource.AUTO
      );
      return;
    }

    // Execute the script in vm2 sandbox
    const result = await this.scriptRunner.run(
      activeScript,
      {
        method,
        params: req.params,
        query: req.query,
        headers: req.headers as Record<string, string>,
        body: req.body,
      },
      tenantId,
      endpoint.id,
    );

    if (!result.success) {
      // Script execution failed
      const responseLog = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: 'Script execution error',
          type: result.error?.type,
          message: result.error?.message,
          name: result.error?.name,
          executionTimeMs: result.executionTimeMs,
        },
      };

      await this.logAndRespond(
        req, res, tenantId, endpoint.id, autoPath, method,
        requestLog, responseLog, startTime, TrafficSource.AUTO
      );
      return;
    }

    // Script executed successfully
    const responseLog = {
      status: result.response!.status,
      headers: result.response!.headers,
      body: result.response!.body,
    };

    await this.logAndRespond(
      req, res, tenantId, endpoint.id, autoPath, method,
      requestLog, responseLog, startTime, TrafficSource.AUTO
    );
  }

  private async logAndRespond(
    req: Request,
    res: Response,
    tenantId: string | null,
    endpointId: string | null,
    route: string,
    method: string,
    requestLog: any,
    responseLog: any,
    startTime: number,
    source: TrafficSource,
  ): Promise<void> {
    const latency = Date.now() - startTime;
    const fullResponseLog = {
      ...responseLog,
      latency,
    };

    // Log traffic
    try {
      await this.trafficService.logTraffic({
        tenantId,
        endpointId,
        route,
        method,
        path: requestLog.path,
        request: requestLog,
        response: fullResponseLog,
        source,
      });
    } catch (logErr) {
      // Don't fail the response if logging fails
      console.error('[AutoHandler] Failed to log traffic:', logErr);
    }

    res.status(responseLog.status).json(responseLog.body);
  }
}
