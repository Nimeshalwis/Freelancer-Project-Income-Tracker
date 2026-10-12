import Client from '../models/Client.js';
import Project from '../models/Project.js';
import Payment from '../models/Payment.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudController } from './crud.controller.js';
import { lockProject, validateProjectFee } from '../services/balance.service.js';
import { projectFilters } from '../utils/projectFilters.js';

export const projectController = createCrudController({
  Model: Project,
  label: 'Project',
  transactional: true,
  prepareWrite: lockProject,
  beforeSave: validateProjectFee,
  listFilter: projectFilters,
  populate: { path: 'client', select: 'name email phone company' },
  references: [{ field: 'client', Model: Client, label: 'Client' }],
  async beforeDelete(project, session) {
    if (await Payment.exists({ project: project._id, user: project.user }).session(session)) throw new ApiError(409, 'Delete or reassign this project’s payments before deleting the project.');
  },
});
