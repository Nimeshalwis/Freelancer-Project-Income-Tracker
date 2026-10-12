import { Router } from 'express';
import { getSummary, getMonthlyIncome, getProjectStatus } from '../controllers/dashboard.controller.js';

const router = Router();
router.get('/summary', getSummary);
router.get('/monthly-income', getMonthlyIncome);
router.get('/project-status', getProjectStatus);
export default router;
