import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { TrafficService } from '../mock/traffic.service';

/**
 * TrafficController handles REST API requests for traffic log retrieval.
 * All operations are scoped to the authenticated tenant from req.tenant.
 */
@injectable()
export class TrafficController {
  constructor(
    @inject(TrafficService) private trafficService: TrafficService,
  ) {}

  /** GET /api/traffic — List traffic logs for the tenant (paginated) */
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const source = req.query.source as string | undefined;

      const result = await this.trafficService.findAll(tenantId, {
        limit: Math.min(limit, 200),
        offset,
        source: source as any,
      });

      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** GET /api/traffic/:id — Get a single traffic log by ID */
  async findById(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const log = await this.trafficService.findOne(tenantId, id);
      if (!log) {
        res.status(404).json({ error: 'Not found', message: 'Traffic log not found' });
        return;
      }
      res.status(200).json(log);
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
