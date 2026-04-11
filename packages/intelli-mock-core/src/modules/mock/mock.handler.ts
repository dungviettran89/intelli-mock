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

/**
 * MockHandler processes runtime mock requests at /_it/mock/*
 *
 * Pipeline:
 * 1. Extract path from request URL
 * 2. Find longest-matching MockEndpoint via RouteMatcher
 * 3. Check for active MockScript
 * 4. Return 503 if no script, or execute script in vm2 sandbox
 * 5. Log request/response to TrafficLog
 */
@injectable()
export class MockHandler {
  private scriptRepo: Repository<MockScript>;

  constructor(
    @inject(RouteMatcher) private routeMatcher: RouteMatcher,
    @inject(MockService) private mockService: MockService,
    @inject(TrafficService) private trafficService: TrafficService,
    @inject(ScriptRunner) private scriptRunner: ScriptRunner,
  ) {
    const ds = getDataSource();
    this.scriptRepo = ds.getRepository(MockScript);
  }

  /**
   * Handles all requests to /_it/mock/*
   * Extracts the path, matches against endpoints, and returns mock response.
   */
  async handle(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const tenantId = req.tenant?.id ?? null;
    const method = req.method.toUpperCase();
    
    // Extract path from /_it/mock/** by stripping the prefix
    const fullPath = req.path;
    const mockPath = fullPath.replace(/^\/_it\/mock/, '') || '/';

    // Build request object for logging
    const requestLog = {
      method,
      path: mockPath,
      params: req.params,
      query: req.query,
      headers: req.headers as Record<string, string>,
      body: req.body,
    };

    try {
      // Step 1: Find matching endpoint
      const candidates = await this.mockService.findCandidates(tenantId || '', method as any);
      const match = this.routeMatcher.match(candidates, method, mockPath);

      if (!match) {
        // No matching endpoint found
        const responseLog = {
          status: 404,
          body: { error: 'Mock endpoint not found', path: mockPath },
        };
        
        await this.logAndRespond(
          req, res, tenantId, null, mockPath, method,
          requestLog, responseLog, startTime, TrafficSource.MOCK
        );
        return;
      }

      // Step 2: Check for active script
      const activeScript = await this.scriptRepo.findOne({
        where: { endpointId: match.endpoint.id, isActive: true },
      });

      if (!activeScript) {
        // No active script - return 503
        const sampleCount = match.endpoint.samplePairs?.length ?? 0;
        const responseLog = {
          status: 503,
          body: {
            error: 'No active mock script',
            message: sampleCount > 0
              ? `Need ${5 - sampleCount} more sample(s) to generate script`
              : 'Need 5+ samples to generate script',
            currentSamples: sampleCount,
            minimumRequired: 5,
          },
        };

        await this.logAndRespond(
          req, res, tenantId, match.endpoint.id, mockPath, method,
          requestLog, responseLog, startTime, TrafficSource.MOCK
        );
        return;
      }

      // Step 3: Execute the script in vm2 sandbox
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
        match.endpoint.id,
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
          req, res, tenantId, match.endpoint.id, mockPath, method,
          requestLog, responseLog, startTime, TrafficSource.MOCK
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
        req, res, tenantId, match.endpoint.id, mockPath, method,
        requestLog, responseLog, startTime, TrafficSource.MOCK
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const responseLog = {
        status: 500,
        body: { error: 'Internal server error', message: errorMessage },
      };

      await this.logAndRespond(
        req, res, tenantId, null, mockPath, method,
        requestLog, responseLog, startTime, TrafficSource.MOCK
      );
    }
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
      console.error('[MockHandler] Failed to log traffic:', logErr);
    }

    res.status(responseLog.status).json(responseLog.body);
  }
}
