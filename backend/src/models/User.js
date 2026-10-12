import { model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { schemaOptions, text } from './shared.js';

const hidePassword = (_doc, result) => { delete result.password; return result; };
const userSchema = new Schema({
  name: text(120, true),
  email: {
    ...text(254, true), lowercase: true, unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be valid.'],
  },
  password: {
    type: String, required: true, select: false,
    validate: {
      validator: (value) => typeof value === 'string' && [...value].length >= 12 && Buffer.byteLength(value, 'utf8') <= 72 && Boolean(value.trim()),
      message: 'Password must be at least 12 characters and at most 72 UTF-8 bytes.',
    },
  },
}, { ...schemaOptions, toJSON: { transform: hidePassword }, toObject: { transform: hidePassword } });

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function (password) { return bcrypt.compare(password, this.password); };

export default model('User', userSchema);
