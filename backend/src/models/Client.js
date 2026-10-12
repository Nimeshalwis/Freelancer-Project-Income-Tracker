import { model, Schema } from 'mongoose';
import { schemaOptions, text, userReference } from './shared.js';

const clientSchema = new Schema({
  name: text(120, true),
  email: {
    ...text(254),
    lowercase: true,
    validate: { validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), message: 'Email must be a valid email address.' },
  },
  phone: text(40),
  company: text(160),
  notes: text(5000),
  user: userReference,
}, schemaOptions);

export default model('Client', clientSchema);
