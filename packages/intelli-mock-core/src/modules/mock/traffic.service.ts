import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { getDataSource } from '../../database/data-source';
import { TrafficLog, TrafficSource, TrafficRequest, TrafficResponse } from '../../entities/traffic-log.entity';

export interface TrafficLogQueryOptions {
  limit?: number;
  offset?: number;
  source?: TrafficSource;
}

export interface PaginatedTrafficLogs {
  data: TrafficLog[];
  total: number;
}

/**
 * TrafficService handles logging and retrieval of all request/response pairs.
 * Every mock request is logged for later inspection and analysis.
 */
@injectable()
export class TrafficService {
  private repo: Repository<TrafficLog>;

  constructor() {
    const ds = getDataSource();
    this.repo = ds.getRepository(TrafficLog);
  }

  /**
   * Logs a complete request/response pair.
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
  }): Promise<TrafficLog> {
    const log = this.repo.create({
      tenantId: params.tenantId,
      endpointId: params.endpointId,
      route: params.route,
      method: params.method,
      path: params.path,
      request: params.request,
      response: params.response,
      source: params.source,
    });
    return this.repo.save(log);
  }

  /**
   * Returns paginated traffic logs for a tenant, ordered by created_at DESC.
   */
  async findAll(
    tenantId: string,
    options: TrafficLogQueryOptions = {},
  ): Promise<PaginatedTrafficLogs> {
    const { limit = 50, offset = 0, source } = options;

    const where: Record<string, unknown> = { tenantId };
    if (source) {
      where.source = source;
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  /**
   * Returns a single traffic log by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findOne(tenantId: string, id: string): Promise<TrafficLog | null> {
    return this.repo.findOne({ where: { tenantId, id } });
  }

  /**
   * Returns paginated traffic logs for a specific endpoint, scoped by tenant.
   */
  async findByEndpoint(
    tenantId: string,
    endpointId: string,
    options: TrafficLogQueryOptions = {},
  ): Promise<PaginatedTrafficLogs> {
    const { limit = 50, offset = 0, source } = options;

    const where: Record<string, unknown> = { tenantId, endpointId };
    if (source) {
      where.source = source;
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  /**
   * Returns the total count of traffic logs for a tenant.
   */
  async countByTenant(tenantId: string): Promise<number> {
    return this.repo.count({ where: { tenantId } });
  }
}
