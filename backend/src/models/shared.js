import { Schema } from 'mongoose';

export const userReference = { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, immutable: true };
export const schemaOptions = { timestamps: true, strict: 'throw', optimisticConcurrency: true };
export const text = (maxlength, required = false) => ({ type: String, trim: true, maxlength, required });
