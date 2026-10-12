import Client from '../models/Client.js';
import Project from '../models/Project.js';
import { ApiError } from '../utils/ApiError.js';
import { createCrudController } from './crud.controller.js';

export const clientController = createCrudController({
  Model: Client,
  label: 'Client',
  async beforeDelete(client) {
    if (await Project.exists({ client: client._id, user: client.user })) throw new ApiError(409, 'Delete or reassign this client’s projects before deleting the client.');
  },
});
