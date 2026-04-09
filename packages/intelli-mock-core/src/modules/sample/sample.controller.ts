import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { SampleService, CreateSamplePairDto, UpdateSamplePairDto } from './sample.service';
import { SampleSource } from '../../entities/sample-pair.entity';

/**
 * SampleController handles REST API requests for sample pair management.
 * All operations are scoped to the authenticated tenant from req.tenant.
 */
@injectable()
export class SampleController {
  constructor(
    @inject(SampleService) private sampleService: SampleService,
  ) {}

  /** GET /api/samples — List all sample pairs for the tenant */
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const samples = await this.sampleService.findAll(tenantId);
      res.status(200).json(samples);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** GET /api/samples/:id — Get a single sample pair by ID */
  async findOne(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const sample = await this.sampleService.findOne(id, tenantId);
      if (!sample) {
        res.status(404).json({ error: 'Not found', message: 'Sample pair not found' });
        return;
      }
      res.status(200).json(sample);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** POST /api/samples — Create a new sample pair */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const dto = this.parseCreateDto(req);

      if (!dto.endpointId) {
        res.status(400).json({ error: 'Bad request', message: 'endpointId is required' });
        return;
      }

      if (!dto.request || !dto.response) {
        res.status(400).json({ error: 'Bad request', message: 'request and response are required' });
        return;
      }

      const sample = await this.sampleService.create(tenantId, dto);
      res.status(201).json(sample);
    } catch (err) {
      if (err instanceof Error && err.message === 'Endpoint not found or does not belong to tenant') {
        res.status(404).json({ error: 'Not found', message: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** PUT /api/samples/:id — Update a sample pair */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const dto = this.parseUpdateDto(req);
      const sample = await this.sampleService.update(id, dto, tenantId);
      if (!sample) {
        res.status(404).json({ error: 'Not found', message: 'Sample pair not found' });
        return;
      }
      res.status(200).json(sample);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** DELETE /api/samples/:id — Delete a sample pair */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const deleted = await this.sampleService.delete(id, tenantId);
      if (!deleted) {
        res.status(404).json({ error: 'Not found', message: 'Sample pair not found' });
        return;
      }
      res.status(204).send();
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

  private parseCreateDto(req: Request): CreateSamplePairDto {
    const body = req.body || {};
    return {
      endpointId: body.endpointId,
      source: body.source as SampleSource | undefined,
      request: body.request,
      response: body.response,
    };
  }

  private parseUpdateDto(req: Request): UpdateSamplePairDto {
    const body = req.body || {};
    const dto: UpdateSamplePairDto = {};
    if (body.source !== undefined) dto.source = body.source as SampleSource;
    if (body.request !== undefined) dto.request = body.request;
    if (body.response !== undefined) dto.response = body.response;
    return dto;
  }

  private messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
