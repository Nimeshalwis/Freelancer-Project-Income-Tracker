import Payment from '../models/Payment.js';
import Project from '../models/Project.js';
import { ApiError } from '../utils/ApiError.js';
import { centsExpression, toCents, fromCents } from '../utils/money.js';

// Every payment mutation writes its project in the same transaction. This creates
// write conflicts between concurrent payments, fee changes, and project deletion.
export async function lockProject(id, session, user, required = true) {
  const project = await Project.findOneAndUpdate({ _id: id, user }, { $inc: { __v: 1 } }, { returnDocument: 'after', session });
  if (!project && required) throw new ApiError(404, 'Project not found.');
  return project;
}

export async function paidCents(projectId, session, user, excludePayment) {
  const match = { project: projectId, user };
  if (excludePayment) match._id = { $ne: excludePayment };
  const [result] = await Payment.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: centsExpression('$amount') } } },
  ]).session(session);
  return result?.total || 0;
}

export async function validatePaymentBalance(payment, session, original) {
  const ids = [...new Set([original?.project?.toString(), payment.project.toString()].filter(Boolean))].sort();
  let target;
  for (const id of ids) {
    const project = await lockProject(id, session, payment.user, id === payment.project.toString());
    if (id === payment.project.toString()) target = project;
  }
  const paid = await paidCents(payment.project, session, payment.user, payment._id);
  const remaining = Math.max(0, toCents(target.fee) - paid);
  if (toCents(payment.amount) > remaining) {
    throw new ApiError(409, 'Payment exceeds the remaining project balance.', [{ field: 'amount', message: `Maximum allowed payment is ${fromCents(remaining)}.` }]);
  }
}

export async function validateProjectFee(project, session) {
  if (toCents(project.fee) < await paidCents(project._id, session, project.user)) {
    throw new ApiError(409, 'Project fee cannot be less than its recorded payments.', [{ field: 'fee', message: 'Increase the fee or adjust the payments first.' }]);
  }
}
