import { model, Schema } from 'mongoose';
import { schemaOptions, text, userReference } from './shared.js';
import { moneyValidator } from '../utils/money.js';

const paymentSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than zero.'],
    validate: moneyValidator,
  },
  paymentDate: { type: Date, required: true, default: Date.now },
  paymentMethod: text(80, true),
  notes: text(5000),
  user: userReference,
}, schemaOptions);

export default model('Payment', paymentSchema);
