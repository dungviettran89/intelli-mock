import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { getDataSource } from '../../database/data-source';
import { MockScript } from '../../entities/mock-script.entity';
import { ScriptValidator } from './script.validator';

export interface CreateScriptDto {
  endpointId: string;
  code: string;
  aiModel: string;
  aiPrompt?: string;
}

/**
 * ScriptService manages MockScript lifecycle with versioning and tenant isolation.
 * All queries are scoped by tenantId to ensure tenant isolation.
 */
@injectable()
export class ScriptService {
  private repo: Repository<MockScript>;
  private validator: ScriptValidator;

  constructor() {
    const ds = getDataSource();
    this.repo = ds.getRepository(MockScript);
    this.validator = new ScriptValidator();
  }

  /**
   * Creates a new script with auto-incremented version.
   * New scripts are created with isActive=false.
   * Validates code syntax before saving.
   */
  async create(tenantId: string, dto: CreateScriptDto): Promise<MockScript> {
    // Verify endpoint belongs to tenant
    const endpointRepo = getDataSource().getRepository('mock_endpoints') as any;
    const endpoint = await endpointRepo.findOne({
      where: { id: dto.endpointId, tenantId },
    });

    if (!endpoint) {
      throw new Error('Endpoint not found or does not belong to tenant');
    }

    // Validate code syntax
    const validation = this.validator.validate(dto.code);
    if (!validation.valid) {
      const script = this.repo.create({
        endpointId: dto.endpointId,
        code: dto.code,
        aiModel: dto.aiModel,
        aiPrompt: dto.aiPrompt ?? null,
        version: 1,
        isActive: false,
        validationError: validation.error,
      });
      return this.repo.save(script);
    }

    // Get next version number
    const version = await this.getNextVersion(dto.endpointId);

    const script = this.repo.create({
      endpointId: dto.endpointId,
      code: dto.code,
      aiModel: dto.aiModel,
      aiPrompt: dto.aiPrompt ?? null,
      version,
      isActive: false,
      validationError: null,
    });

    return this.repo.save(script);
  }

  /**
   * Returns all scripts for a given endpoint, scoped by tenant.
   */
  async findAll(endpointId: string, tenantId: string): Promise<MockScript[]> {
    // Verify endpoint belongs to tenant
    const endpointRepo = getDataSource().getRepository('mock_endpoints') as any;
    const endpoint = await endpointRepo.findOne({
      where: { id: endpointId, tenantId },
    });

    if (!endpoint) {
      return [];
    }

    return this.repo.find({
      where: { endpointId },
      order: { version: 'DESC' },
    });
  }

  /**
   * Returns a single script by ID, scoped to tenant.
   */
  async findOne(id: string, tenantId: string): Promise<MockScript | null> {
    return this.repo
      .createQueryBuilder('script')
      .innerJoin('script.endpoint', 'endpoint')
      .where('script.id = :id', { id })
      .andWhere('endpoint.tenantId = :tenantId', { tenantId })
      .getOne();
  }

  /**
   * Returns the currently active script for an endpoint.
   */
  async findActive(endpointId: string, tenantId: string): Promise<MockScript | null> {
    // Verify endpoint belongs to tenant
    const endpointRepo = getDataSource().getRepository('mock_endpoints') as any;
    const endpoint = await endpointRepo.findOne({
      where: { id: endpointId, tenantId },
    });

    if (!endpoint) {
      return null;
    }

    return this.repo.findOne({
      where: { endpointId, isActive: true },
    });
  }

  /**
   * Activates a script, deactivating all others for the same endpoint.
   * Returns the activated script, or null if not found/doesn't belong to tenant.
   */
  async activate(id: string, tenantId: string): Promise<MockScript | null> {
    const script = await this.findOne(id, tenantId);
    if (!script) {
      return null;
    }

    // Deactivate all scripts for this endpoint
    await this.repo.update(
      { endpointId: script.endpointId },
      { isActive: false },
    );

    // Activate the target script
    script.isActive = true;
    return this.repo.save(script);
  }

  /**
   * Counts scripts for a given endpoint, scoped by tenant.
   */
  async countByEndpoint(endpointId: string, tenantId: string): Promise<number> {
    const endpointRepo = getDataSource().getRepository('mock_endpoints') as any;
    const endpoint = await endpointRepo.findOne({
      where: { id: endpointId, tenantId },
    });

    if (!endpoint) {
      return 0;
    }

    return this.repo.count({
      where: { endpointId },
    });
  }

  /**
   * Gets the next version number for an endpoint.
   */
  private async getNextVersion(endpointId: string): Promise<number> {
    const maxVersion = await this.repo
      .createQueryBuilder('script')
      .select('MAX(script.version)', 'maxVersion')
      .where('script.endpointId = :endpointId', { endpointId })
      .getRawOne();

    return (maxVersion?.maxVersion ?? 0) + 1;
  }
}
