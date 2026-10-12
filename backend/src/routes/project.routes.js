import { projectController } from '../controllers/project.controller.js';
import { createCrudRouter } from './crud.routes.js';

export default createCrudRouter(projectController, {
  projectName: 'string', client: 'id', description: 'string', status: 'string', fee: 'number',
  startDate: 'date', dueDate: 'date',
});
