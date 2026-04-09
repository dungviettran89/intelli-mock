import { Router } from 'express';
import { container } from 'tsyringe';
import { SampleController } from './sample.controller';

/**
 * Creates and configures the Express Router for sample pair management.
 * Mounted at `/api/samples` by the app factory.
 *
 * Routes:
 *   GET    /api/samples       — List all sample pairs (tenant-scoped)
 *   GET    /api/samples/:id   — Get single sample pair
 *   POST   /api/samples       — Create sample pair
 *   PUT    /api/samples/:id   — Update sample pair
 *   DELETE /api/samples/:id   — Delete sample pair
 */
export function createSampleRouter(): Router {
  const router = Router();
  const controller = container.resolve(SampleController);

  router.get('/', (req, res) => controller.findAll(req, res));
  router.get('/:id', (req, res) => controller.findOne(req, res));
  router.post('/', (req, res) => controller.create(req, res));
  router.put('/:id', (req, res) => controller.update(req, res));
  router.delete('/:id', (req, res) => controller.delete(req, res));

  return router;
}
