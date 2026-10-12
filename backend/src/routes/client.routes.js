import { clientController } from '../controllers/client.controller.js';
import { createCrudRouter } from './crud.routes.js';

export default createCrudRouter(clientController, {
  name: 'string', email: 'string', phone: 'string', company: 'string', notes: 'string',
});
