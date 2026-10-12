import { ApiError } from '../utils/ApiError.js';
import mongoose from 'mongoose';

// Controllers share response and persistence behavior; each resource supplies its relationships.
export function createCrudController({ Model, label, populate, references = [], beforeDelete, beforeSave, prepareWrite, transactional = false, listFilter = () => ({}) }) {
  const write = (operation) => transactional ? mongoose.connection.transaction(operation, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }) : operation(null);
  const scopedPopulate = (options, user) => ({ ...options, match: { ...options.match, user }, ...(options.populate ? { populate: scopedPopulate(options.populate, user) } : {}) });
  const populateDocument = async (document, user) => populate ? document.populate(scopedPopulate(populate, user)) : document;
  const findRecord = async (id, user, session = null) => {
    const document = await Model.findOne({ _id: id, user }).session(session);
    if (!document) throw new ApiError(404, `${label} not found.`);
    return document;
  };
  const validateReferences = async (document, session) => {
    for (const { field, Model: Reference, label: referenceLabel } of references) {
      if (document[field] && !await Reference.exists({ _id: document[field], user: document.user }).session(session)) {
        throw new ApiError(404, `${referenceLabel} not found.`, [{ field, message: 'Referenced record does not exist.' }]);
      }
    }
  };
  return {
    async create(req, res) {
      const data = await write(async (session) => {
        const document = new Model({ ...req.body, user: req.user._id });
        document.$session(session);
        await document.validate();
        await validateReferences(document, session);
        if (beforeSave) await beforeSave(document, session);
        await document.save({ session });
        return (await populateDocument(document, req.user._id)).toObject();
      });
      res.status(201).json({ success: true, data });
    },
    async list(req, res) {
      let query = Model.find({ ...await listFilter(req), user: req.user._id }).sort({ createdAt: -1, _id: -1 });
      if (populate) query = query.populate(scopedPopulate(populate, req.user._id));
      res.json({ success: true, data: await query });
    },
    async get(req, res) {
      res.json({ success: true, data: await populateDocument(await findRecord(req.params.id, req.user._id), req.user._id) });
    },
    async update(req, res) {
      const data = await write(async (session) => {
        if (prepareWrite) await prepareWrite(req.params.id, session, req.user._id);
        const document = await findRecord(req.params.id, req.user._id, session);
        const original = document.toObject();
        document.set(req.body);
        await document.validate();
        await validateReferences(document, session);
        if (beforeSave) await beforeSave(document, session, original);
        await document.save({ session });
        return (await populateDocument(document, req.user._id)).toObject();
      });
      res.json({ success: true, data });
    },
    async remove(req, res) {
      const data = await write(async (session) => {
        if (prepareWrite) await prepareWrite(req.params.id, session, req.user._id);
        const document = await findRecord(req.params.id, req.user._id, session);
        if (beforeDelete) await beforeDelete(document, session);
        const result = await Model.deleteOne({ _id: document._id, user: req.user._id, __v: document.__v }, { session });
        if (!result.deletedCount) throw new ApiError(409, `${label} changed during deletion. Retry the request.`);
        return { _id: document._id };
      });
      res.json({ success: true, data, message: `${label} deleted.` });
    },
  };
}
