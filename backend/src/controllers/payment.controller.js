import Payment from '../models/Payment.js';
import Project from '../models/Project.js';
import { createCrudController } from './crud.controller.js';
import { lockProject, validatePaymentBalance } from '../services/balance.service.js';

export const paymentController = createCrudController({
  Model: Payment,
  label: 'Payment',
  transactional: true,
  beforeSave: validatePaymentBalance,
  beforeDelete: (payment, session) => lockProject(payment.project, session, payment.user, false),
  populate: { path: 'project', select: 'projectName client status fee', populate: { path: 'client', select: 'name email company' } },
  references: [{ field: 'project', Model: Project, label: 'Project' }],
});
