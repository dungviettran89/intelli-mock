import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { getDataSource } from '../../database/data-source';
import { TrafficLog, TrafficSource, TrafficRequest, TrafficResponse } from '../../entities/traffic-log.entity';

/**
 * TrafficService handles logging of all request/response pairs.
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
}
