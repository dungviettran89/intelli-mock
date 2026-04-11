import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { ScriptService } from './script.service';
import { ScriptRunner, ScriptExecutionResult } from './script.runner';

/**
 * ScriptController handles REST API requests for script testing.
 * All operations are scoped to the authenticated tenant from req.tenant.
 */
@injectable()
export class ScriptController {
  constructor(
    @inject(ScriptService) private scriptService: ScriptService,
    @inject(ScriptRunner) private scriptRunner: ScriptRunner,
  ) {}

  /** POST /api/scripts/:id/test — Test a script without activating it */
  async test(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const { method, params, query, headers, body } = req.body || {};

      if (!method) {
        res.status(400).json({ error: 'Bad request', message: 'method is required in request body' });
        return;
      }

      // Fetch the script and verify tenant ownership
      const script = await this.scriptService.findOne(id, tenantId);
      if (!script) {
        res.status(404).json({ error: 'Not found', message: 'Script not found' });
        return;
      }

      // Build request context for sandbox execution
      const reqContext = {
        method: method.toUpperCase(),
        params: params ?? {},
        query: query ?? {},
        headers: headers ?? {},
        body: body ?? null,
      };

      // Execute script in sandboxed context
      const result = await this.scriptRunner.run(
        script,
        reqContext,
        tenantId,
        script.endpointId,
      );

      // Return structured result
      if (result.success) {
        res.status(200).json({
          success: true,
          response: result.response,
          executionTimeMs: result.executionTimeMs,
        });
      } else {
        // Script executed but had an error - still return 200 with error details
        res.status(200).json({
          success: false,
          error: result.error,
          executionTimeMs: result.executionTimeMs,
        });
      }
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  private getTenantId(req: Request): string {
    if (!req.tenant?.id) {
      throw new Error('Tenant not attached to request. Auth middleware must run first.');
    }
    return req.tenant.id;
  }

  private messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
