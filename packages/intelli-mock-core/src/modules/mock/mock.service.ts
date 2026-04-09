import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { getDataSource } from '../../database/data-source';
import { MockEndpoint, HttpMethod, MockEndpointStatus } from '../../entities/mock-endpoint.entity';

export interface CreateMockEndpointDto {
  pathPattern: string;
  method?: HttpMethod;
  proxyUrl?: string | null;
  proxyTimeoutMs?: number | null;
  promptExtra?: string | null;
  priority?: number;
  status?: MockEndpointStatus;
}

export interface UpdateMockEndpointDto {
  pathPattern?: string;
  method?: HttpMethod;
  proxyUrl?: string | null;
  proxyTimeoutMs?: number | null;
  promptExtra?: string | null;
  priority?: number;
  status?: MockEndpointStatus;
}

/**
 * MockService provides CRUD operations for MockEndpoint entities.
 * All queries are scoped by tenantId to ensure tenant isolation.
 */
@injectable()
export class MockService {
  private repo: Repository<MockEndpoint>;

  constructor() {
    const ds = getDataSource();
    this.repo = ds.getRepository(MockEndpoint);
  }

  /**
   * Creates a new mock endpoint for the given tenant.
   */
  async create(tenantId: string, dto: CreateMockEndpointDto): Promise<MockEndpoint> {
    const endpoint = this.repo.create({
      tenantId,
      pathPattern: dto.pathPattern,
      method: dto.method ?? HttpMethod.ANY,
      proxyUrl: dto.proxyUrl ?? null,
      proxyTimeoutMs: dto.proxyTimeoutMs ?? null,
      promptExtra: dto.promptExtra ?? null,
      priority: dto.priority ?? 0,
      status: dto.status ?? MockEndpointStatus.DRAFT,
    });
    return this.repo.save(endpoint);
  }

  /**
   * Returns all active mock endpoints for a tenant, sorted by creation date.
   */
  async findAll(tenantId: string, status?: MockEndpointStatus): Promise<MockEndpoint[]> {
    const where: Record<string, unknown> = { tenantId };
    if (status) {
      where.status = status;
    }
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  /**
   * Returns a single mock endpoint by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findById(tenantId: string, id: string): Promise<MockEndpoint | null> {
    return this.repo.findOne({ where: { tenantId, id } });
  }

  /**
   * Updates a mock endpoint by ID, scoped to the given tenant.
   * Returns the updated endpoint, or null if not found.
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateMockEndpointDto,
  ): Promise<MockEndpoint | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) {
      return null;
    }

    if (dto.pathPattern !== undefined) existing.pathPattern = dto.pathPattern;
    if (dto.method !== undefined) existing.method = dto.method;
    if (dto.proxyUrl !== undefined) existing.proxyUrl = dto.proxyUrl;
    if (dto.proxyTimeoutMs !== undefined) existing.proxyTimeoutMs = dto.proxyTimeoutMs;
    if (dto.promptExtra !== undefined) existing.promptExtra = dto.promptExtra;
    if (dto.priority !== undefined) existing.priority = dto.priority;
    if (dto.status !== undefined) existing.status = dto.status;

    return this.repo.save(existing);
  }

  /**
   * Deletes a mock endpoint by ID, scoped to the given tenant.
   * Returns true if deleted, false if not found.
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.repo.delete({ tenantId, id });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Finds all endpoints matching a tenant, method, and path pattern prefix.
   * Used by the RouteMatcher to get candidate endpoints before scoring.
   */
  async findCandidates(tenantId: string, method: HttpMethod | 'ANY'): Promise<MockEndpoint[]> {
    return this.repo.find({
      where: [
        { tenantId, method: method as HttpMethod },
        { tenantId, method: HttpMethod.ANY },
      ],
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }
}
