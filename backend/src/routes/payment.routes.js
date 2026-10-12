import { paymentController } from '../controllers/payment.controller.js';
import { createCrudRouter } from './crud.routes.js';

export default createCrudRouter(paymentController, {
  project: 'id', amount: 'number', paymentDate: 'date', paymentMethod: 'string', notes: 'string',
});
