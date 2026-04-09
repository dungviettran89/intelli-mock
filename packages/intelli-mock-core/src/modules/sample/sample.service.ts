import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { getDataSource } from '../../database/data-source';
import { SamplePair, SampleSource } from '../../entities/sample-pair.entity';
import type { SampleRequest, SampleResponse } from '../../entities/sample-pair.entity';

export interface CreateSamplePairDto {
  endpointId: string;
  source?: SampleSource;
  request: SampleRequest;
  response: SampleResponse;
}

export interface UpdateSamplePairDto {
  source?: SampleSource;
  request?: SampleRequest;
  response?: SampleResponse;
}

/**
 * SampleService provides CRUD operations for SamplePair entities.
 * All queries are scoped by tenantId to ensure tenant isolation.
 */
@injectable()
export class SampleService {
  private repo: Repository<SamplePair>;

  constructor() {
    const ds = getDataSource();
    this.repo = ds.getRepository(SamplePair);
  }

  /**
   * Returns all sample pairs for a given tenant, sorted by creation date.
   * Joins through the endpoint to filter by tenantId.
   */
  async findAll(tenantId: string): Promise<SamplePair[]> {
    return this.repo
      .createQueryBuilder('sample')
      .innerJoin('sample.endpoint', 'endpoint')
      .where('endpoint.tenantId = :tenantId', { tenantId })
      .orderBy('sample.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Returns a single sample pair by ID, scoped to the given tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findOne(id: string, tenantId: string): Promise<SamplePair | null> {
    return this.repo
      .createQueryBuilder('sample')
      .innerJoin('sample.endpoint', 'endpoint')
      .where('sample.id = :id', { id })
      .andWhere('endpoint.tenantId = :tenantId', { tenantId })
      .getOne();
  }

  /**
   * Creates a new sample pair for the given tenant.
   * Validates that the endpoint belongs to the tenant before creating.
   */
  async create(tenantId: string, dto: CreateSamplePairDto): Promise<SamplePair> {
    // Verify the endpoint belongs to this tenant
    const endpointRepo = getDataSource().getRepository('mock_endpoints') as any;
    const endpoint = await endpointRepo.findOne({
      where: { id: dto.endpointId, tenantId },
    });

    if (!endpoint) {
      throw new Error('Endpoint not found or does not belong to tenant');
    }

    const sample = this.repo.create({
      endpointId: dto.endpointId,
      source: dto.source ?? SampleSource.MANUAL,
      request: dto.request,
      response: dto.response,
    });
    return this.repo.save(sample);
  }

  /**
   * Updates a sample pair by ID, scoped to the given tenant.
   * Returns the updated SamplePair, or null if not found.
   */
  async update(
    id: string,
    dto: UpdateSamplePairDto,
    tenantId: string,
  ): Promise<SamplePair | null> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      return null;
    }

    if (dto.source !== undefined) existing.source = dto.source;
    if (dto.request !== undefined) existing.request = dto.request;
    if (dto.response !== undefined) existing.response = dto.response;

    return this.repo.save(existing);
  }

  /**
   * Deletes a sample pair by ID, scoped to the given tenant.
   * Returns true if deleted, false if not found.
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    // First verify the sample belongs to the tenant
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      return false;
    }

    const result = await this.repo.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Counts sample pairs for a given endpoint, scoped by tenant.
   * Used to check if minimum samples (5) are met for AI generation.
   */
  async countByEndpoint(endpointId: string, tenantId: string): Promise<number> {
    return this.repo
      .createQueryBuilder('sample')
      .innerJoin('sample.endpoint', 'endpoint')
      .where('sample.endpointId = :endpointId', { endpointId })
      .andWhere('endpoint.tenantId = :tenantId', { tenantId })
      .getCount();
  }
}
