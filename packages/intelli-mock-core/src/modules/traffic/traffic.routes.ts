import { Router } from 'express';
import { container } from 'tsyringe';
import { TrafficController } from './traffic.controller';

/**
 * Creates and configures the Express Router for traffic log retrieval.
 * Mounted at `/api/traffic` by the app factory.
 *
 * Routes:
 *   GET    /api/traffic        — List traffic logs (tenant-scoped, paginated)
 *   GET    /api/traffic/:id    — Get single traffic log
 */
export function createTrafficRouter(): Router {
  const router = Router();
  const controller = container.resolve(TrafficController);

  router.get('/', (req, res) => controller.findAll(req, res));
  router.get('/:id', (req, res) => controller.findById(req, res));

  return router;
}
