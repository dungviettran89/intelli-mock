import { Router } from 'express';
import { container } from 'tsyringe';
import { MockController } from './mock.controller';

/**
 * Creates and configures the Express Router for mock endpoint management.
 * Mounted at `/api/mocks` by the app factory.
 *
 * Routes:
 *   POST   /api/mocks       — Create mock endpoint
 *   GET    /api/mocks       — List all mock endpoints (tenant-scoped)
 *   GET    /api/mocks/:id   — Get single mock endpoint
 *   PUT    /api/mocks/:id   — Update mock endpoint
 *   DELETE /api/mocks/:id   — Delete mock endpoint
 */
export function createMockRouter(): Router {
  const router = Router();
  const controller = container.resolve(MockController);

  router.post('/', (req, res) => controller.create(req, res));
  router.get('/', (req, res) => controller.findAll(req, res));
  router.get('/:id', (req, res) => controller.findById(req, res));
  router.put('/:id', (req, res) => controller.update(req, res));
  router.delete('/:id', (req, res) => controller.delete(req, res));

  return router;
}
