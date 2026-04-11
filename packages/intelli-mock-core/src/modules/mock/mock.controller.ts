import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { MockService, CreateMockEndpointDto, UpdateMockEndpointDto } from './mock.service';
import { HttpMethod, MockEndpointStatus } from '../../entities/mock-endpoint.entity';
import { AIService } from '../ai/ai.service';
import { ScriptService, CreateScriptDto } from '../script/script.service';
import { SampleService } from '../sample/sample.service';

const MIN_SAMPLES_FOR_GENERATION = 5;

/**
 * MockController handles REST API requests for mock endpoint management.
 * All operations are scoped to the authenticated tenant from req.tenant.
 */
@injectable()
export class MockController {
  constructor(
    @inject(MockService) private mockService: MockService,
    @inject(AIService) private aiService: AIService,
    @inject(ScriptService) private scriptService: ScriptService,
    @inject(SampleService) private sampleService: SampleService,
  ) {}

  /** POST /api/mocks — Create a new mock endpoint */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const dto = this.parseCreateDto(req);

      if (!dto.pathPattern) {
        res.status(400).json({ error: 'Bad request', message: 'pathPattern is required' });
        return;
      }

      const endpoint = await this.mockService.create(tenantId, dto);
      res.status(201).json(endpoint);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** GET /api/mocks — List all mock endpoints for the tenant */
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const status = req.query.status as MockEndpointStatus | undefined;
      const endpoints = await this.mockService.findAll(tenantId, status);
      res.status(200).json(endpoints);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** GET /api/mocks/:id — Get a single mock endpoint by ID */
  async findById(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const endpoint = await this.mockService.findById(tenantId, id);
      if (!endpoint) {
        res.status(404).json({ error: 'Not found', message: 'Mock endpoint not found' });
        return;
      }
      res.status(200).json(endpoint);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** PUT /api/mocks/:id — Update a mock endpoint */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const dto = this.parseUpdateDto(req);
      const endpoint = await this.mockService.update(tenantId, id, dto);
      if (!endpoint) {
        res.status(404).json({ error: 'Not found', message: 'Mock endpoint not found' });
        return;
      }
      res.status(200).json(endpoint);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', message: this.messageOf(err) });
    }
  }

  /** DELETE /api/mocks/:id — Delete a mock endpoint */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      const deleted = await this.mockService.delete(tenantId, id);
      if (!deleted) {
        res.status(404).json({ error: 'Not found', message: 'Mock endpoint not found' });
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

  private parseCreateDto(req: Request): CreateMockEndpointDto {
    const body = req.body || {};
    return {
      pathPattern: body.pathPattern,
      method: body.method as HttpMethod | undefined,
      proxyUrl: body.proxyUrl ?? null,
      proxyTimeoutMs: body.proxyTimeoutMs ?? null,
      promptExtra: body.promptExtra ?? null,
      priority: body.priority ?? 0,
      status: body.status as MockEndpointStatus | undefined,
    };
  }

  private parseUpdateDto(req: Request): UpdateMockEndpointDto {
    const body = req.body || {};
    const dto: UpdateMockEndpointDto = {};
    if (body.pathPattern !== undefined) dto.pathPattern = body.pathPattern;
    if (body.method !== undefined) dto.method = body.method as HttpMethod;
    if (body.proxyUrl !== undefined) dto.proxyUrl = body.proxyUrl;
    if (body.proxyTimeoutMs !== undefined) dto.proxyTimeoutMs = body.proxyTimeoutMs;
    if (body.promptExtra !== undefined) dto.promptExtra = body.promptExtra;
    if (body.priority !== undefined) dto.priority = body.priority;
    if (body.status !== undefined) dto.status = body.status as MockEndpointStatus;
    return dto;
  }

  /** POST /api/mocks/:id/generate — Generate AI mock script from samples */
  async generate(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = this.getTenantId(req);
      const { id: endpointId } = req.params;

      if (!endpointId) {
        res.status(400).json({ error: 'Bad request', message: 'id parameter is required' });
        return;
      }

      // Verify endpoint belongs to tenant
      const endpoint = await this.mockService.findById(tenantId, endpointId);
      if (!endpoint) {
        res.status(404).json({ error: 'Not found', message: 'Mock endpoint not found' });
        return;
      }

      // Check minimum sample count
      const sampleCount = await this.sampleService.countByEndpoint(endpointId, tenantId);
      if (sampleCount < MIN_SAMPLES_FOR_GENERATION) {
        res.status(503).json({
          error: 'Not enough samples',
          message: `Need at least ${MIN_SAMPLES_FOR_GENERATION} samples to generate a script`,
          current: sampleCount,
        });
        return;
      }

      // Fetch all samples for AI prompt
      const samples = await this.sampleService.findAll(tenantId);
      const endpointSamples = samples.filter((s) => s.endpointId === endpointId);

      // Generate script via AI
      const generated = await this.aiService.generateScript({
        samples: endpointSamples,
        pathPattern: endpoint.pathPattern,
        method: endpoint.method,
        promptExtra: endpoint.promptExtra ?? undefined,
      });

      // Save as new script version
      const createDto: CreateScriptDto = {
        endpointId,
        code: generated.code,
        aiModel: generated.model,
        aiPrompt: undefined, // AI service already composed the prompt internally
      };
      const script = await this.scriptService.create(tenantId, createDto);

      res.status(201).json({
        code: generated.code,
        version: script.version,
        model: generated.model,
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
        totalTokens: generated.totalTokens,
        validationError: script.validationError,
      });
    } catch (err) {
      res.status(502).json({
        error: 'AI generation failed',
        message: this.messageOf(err),
      });
    }
  }

  private messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
