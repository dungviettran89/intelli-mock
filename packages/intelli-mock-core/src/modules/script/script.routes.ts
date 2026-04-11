import { Router } from 'express';
import { container } from 'tsyringe';
import { ScriptController } from './script.controller';

/**
 * Creates and configures the Express Router for script testing.
 * Mounted at `/api/scripts` by the app factory.
 *
 * Routes:
 *   POST   /api/scripts/:id/test — Test a script without activating it
 */
export function createScriptRouter(): Router {
  const router = Router();
  const controller = container.resolve(ScriptController);

  router.post('/:id/test', (req, res) => controller.test(req, res));

  return router;
}
