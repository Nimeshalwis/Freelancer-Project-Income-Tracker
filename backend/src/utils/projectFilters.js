import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';
import { isObjectId } from '../middleware/validate.middleware.js';
import Client from '../models/Client.js';

export const PROJECT_STATUSES = ['Pending', 'In Progress', 'Completed'];

export async function projectFilters(req) {
  const filter = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (!['status', 'client', 'search'].includes(key) || typeof value !== 'string') {
      throw new ApiError(400, 'Use only single status, client, and search query parameters.');
    }
  }
  const { status, client, search } = req.query;
  if (status !== undefined) {
    if (!PROJECT_STATUSES.includes(status)) throw new ApiError(400, 'Invalid project status.');
    filter.status = status;
  }
  if (client !== undefined) {
    if (!isObjectId(client)) throw new ApiError(400, 'Invalid client filter ID.');
    if (!await Client.exists({ _id: client, user: req.user._id })) throw new ApiError(404, 'Client not found.');
    filter.client = new mongoose.Types.ObjectId(client);
  }
  if (search !== undefined) {
    if (search.length > 200) throw new ApiError(400, 'Search must be at most 200 characters.');
    const literal = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (literal) filter.projectName = { $regex: literal, $options: 'i' };
  }
  return filter;
}
