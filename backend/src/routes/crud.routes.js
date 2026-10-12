import { Router } from 'express';
import { validateBody, validateId } from '../middleware/validate.middleware.js';

export function createCrudRouter(controller, fields) {
  const router = Router();
  router.route('/').get(controller.list).post(validateBody(fields), controller.create);
  router.route('/:id')
    .all(validateId)
    .get(controller.get)
    .put(validateBody(fields), controller.update)
    .patch(validateBody(fields), controller.update)
    .delete(controller.remove);
  return router;
}
