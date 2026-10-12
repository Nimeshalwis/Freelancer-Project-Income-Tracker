import { model, Schema } from 'mongoose';
import { schemaOptions, text, userReference } from './shared.js';
import { moneyValidator } from '../utils/money.js';
import { PROJECT_STATUSES } from '../utils/projectFilters.js';

const projectSchema = new Schema({
  projectName: text(200, true),
  client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  description: text(5000),
  status: { type: String, enum: PROJECT_STATUSES, default: 'Pending', required: true },
  fee: { type: Number, required: true, min: 0, validate: moneyValidator },
  startDate: Date,
  dueDate: {
    type: Date,
    validate: {
      validator(value) { return !value || !this.startDate || value >= this.startDate; },
      message: 'Due date must be on or after start date.',
    },
  },
  user: userReference,
}, schemaOptions);

export default model('Project', projectSchema);
